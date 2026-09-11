package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/httpapi"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func main() {
	port := env("PORT", "8080")
	databaseURL := os.Getenv("DATABASE_URL")
	jwtSecret := env("JWT_SECRET", "dev-only-change-me")
	aiURL := env("AI_SERVICE_URL", "http://localhost:8090")

	st, err := store.New(databaseURL)
	if err != nil {
		log.Fatalf("initialize store: %v", err)
	}
	defer st.Close()

	authService := auth.New(jwtSecret, 7*24*time.Hour)
	aiClient := ai.New(aiURL)
	server := httpapi.New(st, authService, aiClient)

	log.Printf("LocCaoEnglish API listening on :%s (store=%s)", port, st.Mode())
	if err := http.ListenAndServe(":"+port, server.Handler()); err != nil {
		log.Fatal(err)
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
