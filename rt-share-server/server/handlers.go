package server

import (
	"encoding/json"
	"fmt"

	"golang.org/x/net/websocket"
)

func (s *Server) handleJoin(r Request, ws *websocket.Conn) (Response, error) {
	userID := r.Payload
	s.addUser(userID, ws)

	fmt.Println("User %s joined", userID)

	s.broadcastResponse(Response{
		Type:    r.Type,
		Status:  "userJoin",
		Message: fmt.Sprintf("User %s joined", userID),
		Data:    userID,
	})

	return Response{
		Type:    r.Type,
		Status:  "ok",
		Message: fmt.Sprintf("User %s joined", userID),
		Data:    s.getAllUserIDsJSON(),
	}, nil
}

func (s *Server) handleLeave(r Request, ws *websocket.Conn) (Response, error) {
	userID := r.Payload

	if conn, exists := s.getUserConn(userID); exists && conn == ws {
		s.removeConnection(conn)
		s.broadcastResponse(Response{
			Type:    r.Type,
			Status:  "userLeft",
			Message: fmt.Sprintf("User %s left", userID),
			Data:    userID,
		})
	}

	return Response{
		Type:    r.Type,
		Status:  "ok",
		Message: "Left",
		Data:    s.getAllUserIDsJSON(),
	}, nil
}

func (s *Server) handleForward(r Request, ws *websocket.Conn) (Response, error) {
	targetID := r.Payload
	conn, exists := s.getUserConn(targetID)
	if !exists {
		return Response{
			Type:    r.Type,
			Status:  "error",
			Message: "User not found",
		}, nil
	}

	senderID := s.getSenderUID(ws)
	msg := Response{
		Type:   r.Type,
		Status: "forward",
		Data:   r.Text,
		Sender: senderID,
	}

	jsonBytes, err := json.Marshal(msg)
	if err != nil {
		return Response{Type: r.Type, Status: "error", Message: "marshal error"}, nil
	}
	jsonBytes = append(jsonBytes, '\n')

	if _, err := conn.Write(jsonBytes); err != nil {
		s.removeConnection(conn)
		return Response{Type: r.Type, Status: "error", Message: "forward failed"}, nil
	}

	return Response{Type: r.Type, Status: "ok", Message: "forwarded"}, nil
}

func (s *Server) handleMessage(r Request, ws *websocket.Conn) (Response, error) {
	switch r.Type {
	case "join":
		return s.handleJoin(r, ws)
	case "leave":
		return s.handleLeave(r, ws)
	case "offer":
		return s.handleForward(r, ws)
	case "answer":
		return s.handleForward(r, ws)
	case "candidate":
		return s.handleForward(r, ws)
	default:
		return Response{
			Type:    r.Type,
			Status:  "error",
			Message: fmt.Sprintf("Unknown type: %s", r.Type),
			Data:    "",
		}, nil
	}
}

func (s *Server) broadcastResponse(res Response) {
	resJSON, err := json.Marshal(res)
	if err != nil {
		fmt.Println("broadcast marshal error:", err)
		return
	}
	resJSON = append(resJSON, '\n')

	// Get a copy of connections while locked
	s.mu.RLock()
	conns := make([]*websocket.Conn, 0, len(s.conns))
	for ws, active := range s.conns {
		if active {
			conns = append(conns, ws)
		}
	}
	s.mu.RUnlock()

	// Process connections without holding the lock
	for _, ws := range conns {
		// Check if connection is still active
		if !s.isActiveConnection(ws) {
			continue
		}

		// Write without spawning goroutines (they can cause races)
		if _, err := ws.Write(resJSON); err != nil {
			fmt.Println("Write error, removing connection:", ws.RemoteAddr())
			s.removeConnection(ws)
		}
	}
}

func (s *Server) safeBroadcast(res Response) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("Recovered in safeBroadcast:", r)
		}
	}()
	s.broadcastResponse(res)
}
