package main

import (
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

	// Set up and start the HTTP server on localhost:3000
	server := &http.Server{
		Addr:    "localhost:3000", // Bind to localhost
		Handler: nil,              // Use default handler
	}

	log.Println("Server started on ws://localhost:3000")
	err := server.ListenAndServe()
	if err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
