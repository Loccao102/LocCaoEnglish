package store

import (
	"context"
	"database/sql"
	"errors"
)

func (s *Store) RoleForUser(ctx context.Context, userID string) (string, error) {
	if _, err := s.user(ctx, userID); err != nil {
		return "", err
	}
	if s.db != nil {
		if err := s.ensureContentSchema(ctx); err != nil {
			return "", err
		}
		var role string
		err := s.db.QueryRowContext(ctx, `SELECT role FROM user_roles WHERE user_id=$1`, userID).Scan(&role)
		if errors.Is(err, sql.ErrNoRows) {
			_, err = s.db.ExecContext(ctx, `INSERT INTO user_roles(user_id,role,updated_at) VALUES($1,'learner',NOW()) ON CONFLICT(user_id) DO NOTHING`, userID)
			if err == nil {
				// Preserve a concurrent operator's assignment instead of
				// returning an assumed learner role after ON CONFLICT.
				err = s.db.QueryRowContext(ctx, `SELECT role FROM user_roles WHERE user_id=$1`, userID).Scan(&role)
			}
		}
		return role, err
	}
	state := s.contentMemory()
	state.mu.Lock()
	defer state.mu.Unlock()
	if role := state.roles[userID]; role != "" {
		return role, nil
	}
	state.roles[userID] = "learner"
	return "learner", nil
}

// SetUserRole is for trusted operators. Public registration cannot grant roles.
func (s *Store) SetUserRole(ctx context.Context, userID, role string) error {
	if role != "learner" && role != "teacher" && role != "admin" {
		return errors.New("invalid role")
	}
	if _, err := s.user(ctx, userID); err != nil {
		return err
	}
	if s.db != nil {
		if err := s.ensureContentSchema(ctx); err != nil {
			return err
		}
		_, err := s.db.ExecContext(ctx, `INSERT INTO user_roles(user_id,role,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role,updated_at=NOW()`, userID, role)
		return err
	}
	state := s.contentMemory()
	state.mu.Lock()
	defer state.mu.Unlock()
	state.roles[userID] = role
	return nil
}
