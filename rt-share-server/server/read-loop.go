package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"golang.org/x/net/websocket"
)

func (s *Server) readLoop(ws *websocket.Conn) {
    defer func() {
        fmt.Println("Closing connection from", ws.RemoteAddr())
        s.safeRemoveConnection(ws)
    }()

    buf := make([]byte, 1024)
    var partialMsg []byte

    for {
        n, err := ws.Read(buf)
        if err != nil {
            if err == io.EOF {
                fmt.Println("Client disconnected normally:", ws.RemoteAddr())
            } else {
                fmt.Println("Read error:", err, "from", ws.RemoteAddr())
            }
            return
        }

        partialMsg = append(partialMsg, buf[:n]...)

        for {
            idx := bytes.IndexByte(partialMsg, '\n')
            if idx == -1 {
                break
            }

            msg := partialMsg[:idx]
            partialMsg = partialMsg[idx+1:]

            var req Request
            if err := json.Unmarshal(msg, &req); err != nil {
                fmt.Println("Invalid JSON:", string(msg), "from", ws.RemoteAddr())
                continue
            }

            res, err := s.handleMessage(req, ws)
            if err != nil {
                fmt.Println("Message handling error:", err, "from", ws.RemoteAddr())
                continue
            }

            resJSON, err := res.toJson()
            if err != nil {
                fmt.Println("Response marshaling error:", err)
                continue
            }

            if _, err := ws.Write(resJSON); err != nil {
                fmt.Println("Write error to", ws.RemoteAddr(), ":", err)
                return
            }
        }
    }
}
