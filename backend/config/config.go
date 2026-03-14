package config

import (
	"bufio"
	"os"
	"strings"
)

type Config struct {
	MongoURI    string
	DBName      string
	Port        string
	JWTSecret   string
	FrontendURL string
}

func Load() *Config {
	loadEnvFile(".env")

	return &Config{
		MongoURI:    getEnv("THREELAB_MONGO_URI", "mongodb://localhost:27017"),
		DBName:      getEnv("THREELAB_DB_NAME", "threelab"),
		Port:        getEnv("THREELAB_PORT", "4912"),
		JWTSecret:   getEnv("THREELAB_JWT_SECRET", "threelab-dev-secret"),
		FrontendURL: getEnv("THREELAB_FRONTEND_URL", "http://localhost:4911"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func loadEnvFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(k)
		v = strings.TrimSpace(v)
		if os.Getenv(k) == "" {
			os.Setenv(k, v)
		}
	}
}
