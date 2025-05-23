package server

import (
	"encoding/json"
	"fmt"
	"golang.org/x/net/websocket"
	"runtime/debug"
	"time"
)

type userInfo struct {
	ID string `json:"id"`
	IP string `json:"ip"`
}

func (s *Server) getAllUserInfoJSON() string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	infos := make([]userInfo, 0, len(s.users))
	for id, conn := range s.users {
		ip := s.connIPs[conn]
		infos = append(infos, userInfo{ID: id, IP: ip})
	}

	jsonBytes, err := json.Marshal(infos)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

func (s *Server) getUserConn(userID string) (*websocket.Conn, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	conn, exists := s.users[userID]
	return conn, exists
}

func (s *Server) addUser(userID string, ws *websocket.Conn) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.users[userID] = ws
	if ip, ok := s.connIPs[ws]; ok {
		s.userIPs[userID] = ip
	}
}

func (s *Server) getSenderUID(ws *websocket.Conn) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for id, conn := range s.users {
		if conn == ws {
			return id
		}
	}
	return ""
}

func (s *Server) isActiveConnection(ws *websocket.Conn) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.conns[ws]
}

func (s *Server) safeRemoveConnection(ws *websocket.Conn) {
	done := make(chan bool)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("PANIC in removeConnection: %v\nStack:\n%s\n",
					r, debug.Stack())
			}
		}()
		s.removeConnection(ws)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		fmt.Printf("DEADLOCK DETECTED removing connection %v\nStack:\n%s\n",
			ws.RemoteAddr(), debug.Stack())
	}
}

func (s *Server) logState() {
	s.mu.RLock()
	defer s.mu.RUnlock()
	fmt.Printf("Server state - Connections: %d, Users: %d\n",
		len(s.conns), len(s.users))
}
