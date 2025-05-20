package main

import (
	"crypto/tls"
	"diesiws/server"
	"log"
	"net/http"
	"time"
)

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

	// Paths to your SSL certificate and private key
	certFile := "/etc/letsencrypt/live/rt-share.diesing.pro/fullchain.pem"
	keyFile := "/etc/letsencrypt/live/rt-share.diesing.pro/privkey.pem"

	// Set up TLS config for the server
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS13,
	}

	// Listen and serve with HTTPS (for wss)
	server := &http.Server{
		Addr:      ":3000", // Listen on port 3000
		Handler:   nil,     // Default handler (we already registered it)
		TLSConfig: tlsConfig,
	}

	log.Println("Server started on wss://rt-share.diesing.pro:3000")
	err := server.ListenAndServeTLS(certFile, keyFile)
	if err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
