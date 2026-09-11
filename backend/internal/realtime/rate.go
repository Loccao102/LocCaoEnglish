package realtime

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type localRateBucket struct {
	count   int
	expires time.Time
}

var localRateState = struct {
	sync.Mutex
	items map[string]localRateBucket
}{items: map[string]localRateBucket{}}

func (s *Service) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	if limit <= 0 { return false, nil }
	if s.client != nil {
		redisKey := "loccao:rate:" + key
		count, err := s.client.Incr(ctx, redisKey).Result()
		if err != nil { return false, err }
		if count == 1 { _ = s.client.Expire(ctx, redisKey, window).Err() }
		return count <= int64(limit), nil
	}
	localRateState.Lock()
	defer localRateState.Unlock()
	now := time.Now()
	bucket := localRateState.items[key]
	if bucket.expires.IsZero() || now.After(bucket.expires) {
		bucket = localRateBucket{count: 0, expires: now.Add(window)}
	}
	bucket.count++
	localRateState.items[key] = bucket
	return bucket.count <= limit, nil
}

func RateKey(scope, client string) string { return fmt.Sprintf("%s:%s", scope, client) }
