package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

const passwordIterations = 120000

type Service struct {
	secret []byte
	ttl    time.Duration
}

type claims struct {
	Sub string `json:"sub"`
	Exp int64  `json:"exp"`
	Iat int64  `json:"iat"`
}

func New(secret string, ttl time.Duration) *Service {
	return &Service{secret: []byte(secret), ttl: ttl}
}

func HashPassword(password string) (string, error) {
	if len(password) < 8 {
		return "", errors.New("password must contain at least 8 characters")
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := pbkdf2([]byte(password), salt, passwordIterations, 32)
	return fmt.Sprintf("pbkdf2-sha256$%d$%s$%s", passwordIterations, base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(hash)), nil
}

func VerifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2-sha256" {
		return false
	}
	iterations, err := strconv.Atoi(parts[1])
	if err != nil || iterations < 10000 || iterations > 1000000 {
		return false
	}
	salt, err1 := base64.RawStdEncoding.DecodeString(parts[2])
	expected, err2 := base64.RawStdEncoding.DecodeString(parts[3])
	if err1 != nil || err2 != nil {
		return false
	}
	actual := pbkdf2([]byte(password), salt, iterations, len(expected))
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func (s *Service) Issue(userID string) (string, error) {
	now := time.Now().Unix()
	header, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	payload, _ := json.Marshal(claims{Sub: userID, Iat: now, Exp: time.Now().Add(s.ttl).Unix()})
	unsigned := b64(header) + "." + b64(payload)
	sig := sign(s.secret, unsigned)
	return unsigned + "." + b64(sig), nil
}

func (s *Service) Parse(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", errors.New("invalid token")
	}
	unsigned := parts[0] + "." + parts[1]
	provided, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(provided, sign(s.secret, unsigned)) {
		return "", errors.New("invalid signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", errors.New("invalid payload")
	}
	var c claims
	if err := json.Unmarshal(payload, &c); err != nil || c.Sub == "" || time.Now().Unix() >= c.Exp {
		return "", errors.New("expired or invalid token")
	}
	return c.Sub, nil
}

func pbkdf2(password, salt []byte, iterations, keyLen int) []byte {
	hashLen := 32
	blocks := (keyLen + hashLen - 1) / hashLen
	out := make([]byte, 0, blocks*hashLen)
	for block := 1; block <= blocks; block++ {
		mac := hmac.New(sha256.New, password)
		mac.Write(salt)
		idx := make([]byte, 4)
		binary.BigEndian.PutUint32(idx, uint32(block))
		mac.Write(idx)
		u := mac.Sum(nil)
		t := append([]byte(nil), u...)
		for i := 1; i < iterations; i++ {
			mac = hmac.New(sha256.New, password)
			mac.Write(u)
			u = mac.Sum(nil)
			for j := range t {
				t[j] ^= u[j]
			}
		}
		out = append(out, t...)
	}
	return out[:keyLen]
}

func sign(secret []byte, value string) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(value))
	return mac.Sum(nil)
}

func b64(value []byte) string { return base64.RawURLEncoding.EncodeToString(value) }
