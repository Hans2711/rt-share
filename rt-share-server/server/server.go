package server

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"golang.org/x/net/websocket"
	"sync"
	"time"
)

type Server struct {
	conns map[*websocket.Conn]bool
	users map[string]*websocket.Conn
	mu    sync.RWMutex
}

func NewServer() *Server {
	return &Server{
		conns: make(map[*websocket.Conn]bool),
		users: make(map[string]*websocket.Conn),
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

	// Broadcast user left if needed
	if userID != "" {
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

func generateID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}
