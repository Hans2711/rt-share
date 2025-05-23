package server

import (
	"fmt"
	"golang.org/x/net/websocket"
	"net"
	"strings"
	"sync"
	"time"
)

// resolveAddrIP takes an address string and attempts to return the
// underlying IP address. If the address already contains an IP, it is
// returned directly. If it contains a hostname, the first resolved IP
// is returned. If resolution fails, the original host portion is
// returned.
func resolveAddrIP(addr string) string {
	if strings.Contains(addr, "://") {
		parts := strings.SplitN(addr, "://", 2)
		addr = parts[1]
	}
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = addr
	}
	if ip := net.ParseIP(host); ip != nil {
		return ip.String()
	}
	ips, err := net.LookupIP(host)
	if err == nil && len(ips) > 0 {
		return ips[0].String()
	}
	return host
}

// getClientIP extracts the originating IP address for a websocket connection.
// It first checks the websocket's associated HTTP request for standard
// forwarding headers and falls back to the remote address on the connection.
func getClientIP(ws *websocket.Conn) string {
	if ws == nil {
		return ""
	}

	// Attempt to use information from the HTTP request when available.
	if req := ws.Request(); req != nil {
		// Check common proxy headers first.
		if ip := req.Header.Get("X-Forwarded-For"); ip != "" {
			parts := strings.Split(ip, ",")
			if len(parts) > 0 {
				ip = strings.TrimSpace(parts[0])
				if ip != "" {
					return resolveAddrIP(ip)
				}
			}
		}
		if ip := req.Header.Get("X-Real-IP"); ip != "" {
			return resolveAddrIP(strings.TrimSpace(ip))
		}
		if host, _, err := net.SplitHostPort(req.RemoteAddr); err == nil {
			return resolveAddrIP(host)
		}
		return resolveAddrIP(req.RemoteAddr)
	}

	// Fallback to the connection's remote address.
	return resolveAddrIP(ws.RemoteAddr().String())
}

type Server struct {
	conns   map[*websocket.Conn]bool
	users   map[string]*websocket.Conn
	userIPs map[string]string
	connIPs map[*websocket.Conn]string
	mu      sync.RWMutex
}

func NewServer() *Server {
	return &Server{
		conns:   make(map[*websocket.Conn]bool),
		users:   make(map[string]*websocket.Conn),
		userIPs: make(map[string]string),
		connIPs: make(map[*websocket.Conn]string),
	}
}

func (s *Server) removeConnection(ws *websocket.Conn) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Skip if already removed
	if _, exists := s.conns[ws]; !exists {
		return
	}

	// Mark as inactive but don't delete yet
	s.conns[ws] = false

	// Find user associated with this connection
	var userID string
	for id, conn := range s.users {
		if conn == ws {
			userID = id
			delete(s.users, id)
			break
		}
	}

	// Close the connection
	ws.Close()

	// Remove IP tracking
	delete(s.connIPs, ws)

	// Broadcast user left if needed
	if userID != "" {
		delete(s.userIPs, userID)
		go s.safeBroadcast(Response{
			Type:    "leave",
			Status:  "userLeft",
			Message: fmt.Sprintf("User %s left", userID),
			Data:    userID,
		})
	}
}

func (s *Server) addConnection(ws *websocket.Conn) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.conns[ws] = true
	s.connIPs[ws] = getClientIP(ws)
}

func WSHandler(s *Server) websocket.Handler {
	return func(ws *websocket.Conn) {
		// Check if this is a duplicate connection
		if s.isActiveConnection(ws) {
			fmt.Println("Duplicate connection from", ws.RemoteAddr())
			ws.Close()
			return
		}

		fmt.Println("new incoming connection from client", ws.RemoteAddr())
		s.addConnection(ws)

		// Set up connection tracking
		ws.SetDeadline(time.Now().Add(5 * time.Minute))

		defer func() {
			fmt.Println("Connection cleanup for", ws.RemoteAddr())
			s.removeConnection(ws)
		}()

		s.readLoop(ws)
	}
}
