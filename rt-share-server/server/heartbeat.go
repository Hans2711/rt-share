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

    // Copy active connections under read lock to avoid map races
    s.mu.RLock()
    conns := make([]*websocket.Conn, 0, len(s.conns))
    for ws, active := range s.conns {
        if active {
            conns = append(conns, ws)
        }
    }
    s.mu.RUnlock()

    // Write heartbeats serially per connection to avoid concurrent writes
    for _, ws := range conns {
        if !s.isActiveConnection(ws) {
            continue
        }
        mu := s.getWriteMu(ws)
        mu.Lock()
        _, err := ws.Write(resJSON)
        mu.Unlock()
        if err != nil {
            fmt.Println("Heartbeat failed, closing connection")
            s.removeConnection(ws)
        }
    }
}
