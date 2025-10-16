package main

import (
    "bytes"
    "crypto/tls"
    "encoding/json"
    "encoding/pem"
    "errors"
    "fmt"
    "diesiws/server"
    "log"
    "net/http"
    "os"
    "path/filepath"
    "time"
)

type TLSSettings struct {
    Address        string `json:"address"`           // e.g. ":3000"
    CertFile       string `json:"cert_file"`         // path to certificate (may omit if using combined/everything)
    KeyFile        string `json:"key_file"`          // path to private key
    CombinedFile   string `json:"combined_file"`     // certificate + intermediates (no key)
    EverythingFile string `json:"everything_file"`   // PEM containing key + certificate + chain
    CAFile         string `json:"ca_file"`           // optional extra CA/intermediate bundle to append
    MinVersion     string `json:"min_version"`       // "1.2" (default) or "1.3"
}

type AppConfig struct {
    TLS TLSSettings `json:"tls"`
}

func loadConfig() (*AppConfig, string, error) {
    // Allow override via env var
    if p := os.Getenv("RT_SHARE_CONFIG"); p != "" {
        cfg, err := readConfig(p)
        return cfg, p, err
    }
    if p := os.Getenv("RTS_CONFIG"); p != "" { // short alias
        cfg, err := readConfig(p)
        return cfg, p, err
    }

    // Search common locations relative to CWD and executable directory
    candidates := []string{"config.json", filepath.Join("..", "config.json")}

    if exe, err := os.Executable(); err == nil {
        exeDir := filepath.Dir(exe)
        candidates = append(candidates,
            filepath.Join(exeDir, "config.json"),
            filepath.Join(exeDir, "..", "config.json"),
        )
    }

    for _, p := range candidates {
        if _, err := os.Stat(p); err == nil {
            cfg, err := readConfig(p)
            return cfg, p, err
        }
    }

    return nil, "", fmt.Errorf("config.json not found in project root; checked %v", candidates)
}

func readConfig(path string) (*AppConfig, error) {
    b, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }
    var cfg AppConfig
    if err := json.Unmarshal(b, &cfg); err != nil {
        return nil, err
    }
    return &cfg, nil
}

// resolvePath returns an absolute path when given an absolute input;
// otherwise it resolves relative to baseDir.
func resolvePath(baseDir, p string) string {
    if p == "" {
        return ""
    }
    if filepath.IsAbs(p) {
        return p
    }
    return filepath.Clean(filepath.Join(baseDir, p))
}

func minTLSVersion(s string) uint16 {
    switch s {
    case "1.3", "TLS1.3", "tls1.3":
        return tls.VersionTLS13
    default:
        return tls.VersionTLS12
    }
}

func buildTLSConfig(baseDir string, t TLSSettings) (*tls.Config, error) {
    var cert tls.Certificate
    var err error

    switch {
    case t.EverythingFile != "":
        cert, err = loadFromEverything(resolvePath(baseDir, t.EverythingFile), resolvePath(baseDir, t.CAFile))
    case t.CombinedFile != "" && t.KeyFile != "":
        cert, err = loadFromPair(resolvePath(baseDir, t.CombinedFile), resolvePath(baseDir, t.KeyFile), resolvePath(baseDir, t.CAFile))
    case t.CertFile != "" && t.KeyFile != "":
        cert, err = loadFromPair(resolvePath(baseDir, t.CertFile), resolvePath(baseDir, t.KeyFile), resolvePath(baseDir, t.CAFile))
    default:
        err = errors.New("invalid TLS configuration: set either everything_file, or combined_file+key_file, or cert_file+key_file")
    }
    if err != nil {
        return nil, err
    }

    return &tls.Config{
        MinVersion:   minTLSVersion(t.MinVersion),
        Certificates: []tls.Certificate{cert},
    }, nil
}

func loadFromPair(certPath, keyPath, caPath string) (tls.Certificate, error) {
    certPEM, err := os.ReadFile(certPath)
    if err != nil {
        return tls.Certificate{}, err
    }
    if caPath != "" {
        if caPEM, err := os.ReadFile(caPath); err == nil {
            certPEM = append(certPEM, caPEM...)
        } else {
            return tls.Certificate{}, fmt.Errorf("failed reading ca_file: %w", err)
        }
    }
    keyPEM, err := os.ReadFile(keyPath)
    if err != nil {
        return tls.Certificate{}, err
    }
    return tls.X509KeyPair(certPEM, keyPEM)
}

func loadFromEverything(everythingPath, caPath string) (tls.Certificate, error) {
    data, err := os.ReadFile(everythingPath)
    if err != nil {
        return tls.Certificate{}, err
    }
    var certBuf bytes.Buffer
    var keyPEM []byte
    rest := data
    for {
        var block *pem.Block
        block, rest = pem.Decode(rest)
        if block == nil {
            break
        }
        switch block.Type {
        case "CERTIFICATE":
            if _, err := certBuf.Write(pem.EncodeToMemory(block)); err != nil {
                return tls.Certificate{}, err
            }
        case "PRIVATE KEY", "RSA PRIVATE KEY", "EC PRIVATE KEY", "DSA PRIVATE KEY", "ED25519 PRIVATE KEY":
            if len(keyPEM) == 0 {
                keyPEM = pem.EncodeToMemory(block)
            }
        }
    }
    if caPath != "" {
        if caPEM, err := os.ReadFile(caPath); err == nil {
            certBuf.Write(caPEM)
        } else {
            return tls.Certificate{}, fmt.Errorf("failed reading ca_file: %w", err)
        }
    }
    certPEM := certBuf.Bytes()
    if len(certPEM) == 0 || len(keyPEM) == 0 {
        return tls.Certificate{}, errors.New("failed to parse PEM blocks from everything_file (need CERTIFICATE and PRIVATE KEY)")
    }
    return tls.X509KeyPair(certPEM, keyPEM)
}

func main() {
    // Create your server instance
    s := server.NewServer()

    // WebSocket handler
    http.Handle("/", server.WSHandler(s))

    // Run a background goroutine for heartbeats
    go func() {
        ticker := time.NewTicker(4 * time.Minute)
        defer ticker.Stop()

        for range ticker.C {
            s.SendHeartbeat()
        }
    }()

    // Load TLS configuration from project-root config.json
    cfg, cfgPath, err := loadConfig()
    if err != nil {
        log.Fatalf("failed to load config: %v", err)
    }

    cfgDir := filepath.Dir(cfgPath)
    tlsConfig, err := buildTLSConfig(cfgDir, cfg.TLS)
    if err != nil {
        log.Fatalf("failed to load TLS material (from %s): %v", cfgPath, err)
    }

    addr := cfg.TLS.Address
    if addr == "" {
        addr = ":3000"
    }

    // Listen and serve with HTTPS (for wss)
    httpServer := &http.Server{
        Addr:      addr,
        Handler:   nil, // Default handler (we already registered it)
        TLSConfig: tlsConfig,
    }

    log.Printf("Server started on wss://%s (config: %s)", addr, cfgPath)
    if err := httpServer.ListenAndServeTLS("", ""); err != nil {
        log.Fatalf("Server failed: %v", err)
    }
}
