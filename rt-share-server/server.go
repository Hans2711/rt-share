package main

import (
	"diesiws/server"
	"net/http"
	"time"
)

func main() {
	s := server.NewServer()
	http.Handle("/", server.WSHandler(s))

	go func() {
		ticker := time.NewTicker(4 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			s.SendHeartbeat()
		}
	}()

	http.ListenAndServe(":3000", nil)
}
