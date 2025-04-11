package server

import (
	"fmt"
	"golang.org/x/net/websocket"
)

func (s *Server) SendHeartbeat() {
	resJSON, err := Response{
		Type:   "heartbeat",
		Status: "ping",
	}.toJson()
	if err != nil {
		fmt.Println("heartbeat marshal error:", err)
		return
	}

	for ws := range s.conns {
		if !s.conns[ws] {
			continue
		}

		go func(ws *websocket.Conn) {
			if _, err := ws.Write(resJSON); err != nil {
				fmt.Println("Heartbeat failed, closing connection")
				s.removeConnection(ws)
			}
		}(ws)
	}
}
