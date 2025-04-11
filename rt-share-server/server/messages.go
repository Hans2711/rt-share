package server

import (
	"encoding/json"
	"fmt"

	"golang.org/x/net/websocket"
)

type Request struct {
	Type    string `json:"type"`
	Payload string `json:"payload"`
	Text    string `json:"text"`
	Filename    string `json:"filename"`
	Bytes    []byte `json:"bytes"`
}

type Response struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Message string `json:"message"`
	Data    string `json:"data"`
	Filename    string `json:"filename"`
	Sender    string `json:"sender"`
	Bytes    []byte `json:"bytes"`
}

type AllowedSend struct {
	Sender    string 
	Receiver    string
}

type SendQueue struct {
    response Response
    sender *websocket.Conn
    receiver *websocket.Conn
}

func (r Response) toJson() ([]byte, error) {
	resJSON, err := json.Marshal(r)
	if err != nil {
		return nil, fmt.Errorf("error marshaling response to JSON: %w", err)
	}
	return append(resJSON, '\n'), nil
}
