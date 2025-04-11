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

func (s *Server) handleSendText(r Request, ws *websocket.Conn) (Response, error) {
	userID := r.Payload
	text := r.Text

    conn, exists := s.getUserConn(userID)
	if !exists {
		return Response{
			Type:    r.Type,
			Status:  "error",
			Message: "User not found",
		}, nil
	}

    senderUid := s.getSenderUID(ws) // Use synchronized method

	msg := Response{
		Type:   r.Type,
		Status: "dataSend",
		Data:   text,
        Sender: senderUid,
	}

	jsonBytes, err := json.Marshal(msg)
	if err != nil {
		return Response{
			Type:    r.Type,
			Status:  "error",
			Message: "Failed to marshal message",
		}, nil
	}
	jsonBytes = append(jsonBytes, '\n')

	if _, err := conn.Write(jsonBytes); err != nil {
		s.removeConnection(conn)
		return Response{
			Type:    r.Type,
			Status:  "error",
			Message: "Failed to send to user",
		}, nil
	}

	return Response{
        Type: r.Type,
		Status:  "ok",
		Message: "Sent data",
	}, nil
}

func (s *Server) handleSendFile(r Request, ws *websocket.Conn) (Response, error) {
	userID := r.Payload
	filename := r.Filename
	bytes := r.Bytes

    conn, exists := s.getUserConn(userID)
	if !exists {
		return Response{
			Type:    r.Type,
			Status:  "error",
			Message: "User not found",
		}, nil
	}

    senderUid := s.getSenderUID(ws)
    receiverUid := s.getAllowedSend(senderUid)


	msgFinalSend := Response{
		Type:     r.Type,
		Status:   "dataSend",
		Filename: filename,
		Bytes:    bytes,
        Sender:   senderUid,
		Message:  fmt.Sprintf("File %s sent", filename),
	}

	if receiverUid == "" {
		msg := Response{
			Type:     r.Type,
			Status:   "requestSendFile",
			Filename: filename,
			Data:     senderUid,
			Message:  fmt.Sprintf("Request send file %s sent", filename),
		}

		jsonBytes, _ := msg.toJson()
		jsonBytes = append(jsonBytes, '\n')

		if _, err := conn.Write(jsonBytes); err != nil {
			s.removeConnection(conn)
			return Response{
				Type:    r.Type,
				Status:  "error",
				Message: "Failed to send request",
			}, nil
		}

		q := SendQueue{
			response: msgFinalSend,
			sender:  ws,
			receiver: conn,
		}
		s.sendQueue[userID] = &q

		return Response{
			Type:    r.Type,
			Status:  "ok",
			Message: fmt.Sprintf("File %s request sent %s", filename, userID),
		}, nil
	}

	jsonBytes, _ := msgFinalSend.toJson()
	jsonBytes = append(jsonBytes, '\n')

	if _, err := conn.Write(jsonBytes); err != nil {
		s.removeConnection(conn)
		return Response{
			Type:    r.Type,
			Status:  "error",
			Message: "Failed to send file to user",
		}, nil
	}

	return Response{
		Type:    r.Type,
		Status:  "ok",
		Message: fmt.Sprintf("File %s sent to user %s", filename, userID),
	}, nil
}

func (s *Server) handleAcceptFile(r Request, ws *websocket.Conn) (Response, error) {
	userID := r.Payload
	var senderConn *websocket.Conn
	var receiverUid string

	for id, conn := range s.users {
		if ws == conn {
			receiverUid = id
		}
		if id == userID {
			senderConn = conn
		}
	}

	if receiverUid == "" {
		return Response{
			Type:    r.Type,
			Status:  "error",
			Message: "Failed to get Receiver in users",
		}, nil
	}

    s.setAllowedSend(userID, receiverUid) // Use the synchronized setter


	for userIDKey, sendQueue := range s.sendQueue {
		if sendQueue.receiver == ws && sendQueue.sender == senderConn {
            response := sendQueue.response
            delete(s.sendQueue, userIDKey)
            return response, nil
		}
	}

	return Response{
		Type:    r.Type,
		Status:  "ok",
		Message: fmt.Sprintf("Accpeted from user %s", userID),
	}, nil
}

func (s *Server) handleDenyFile(r Request, ws *websocket.Conn) (Response, error) {
	userID := r.Payload
	receiverUid := ""

	for id, conn := range s.users {
		if ws == conn {
			receiverUid = id
		}
	}

	if receiverUid == "" {
		return Response{
			Type:    r.Type,
			Status:  "error",
			Message: "Receiver not found",
		}, nil
	}

    s.clearAllowedSend(userID)

	for _, sendQueue := range s.sendQueue {
		if sendQueue.receiver == ws {
			delete(s.sendQueue, userID)
			return Response{
				Type:    r.Type,
				Status:  "ok",
				Message: fmt.Sprintf("File request for %s denied", userID),
			}, nil
		}
	}

	return Response{
		Type:    r.Type,
		Status:  "error",
		Message: "No pending file request",
	}, nil
}

func (s *Server) handleMessage(r Request, ws *websocket.Conn) (Response, error) {
	switch r.Type {
	case "join":
		return s.handleJoin(r, ws)
	case "leave":
		return s.handleLeave(r, ws)
	case "sendText":
		return s.handleSendText(r, ws)
	case "sendFile":
		return s.handleSendFile(r, ws)
	case "acceptFile":
		return s.handleAcceptFile(r, ws)
	case "denyFile":
		return s.handleDenyFile(r, ws)
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
