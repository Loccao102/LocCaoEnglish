// roles is an operator command. It deliberately exposes no HTTP endpoint.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

type roleStore interface {
	SetUserRole(context.Context, string, string) error
	Close()
}

func main() {
	err := run(os.Args[1:], os.Getenv("DATABASE_URL"), os.Stdout, func(databaseURL string) (roleStore, error) {
		return store.New(databaseURL)
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, databaseURL string, output io.Writer, open func(string) (roleStore, error)) error {
	flags := flag.NewFlagSet("roles", flag.ContinueOnError)
	// Never echo unknown arguments: they could accidentally include a credential.
	flags.SetOutput(io.Discard)
	userID := flags.String("user-id", "", "existing, independently verified account ID")
	role := flags.String("role", "", "learner, teacher or admin")
	if err := flags.Parse(args); err != nil || flags.NArg() != 0 {
		return errors.New("usage: roles --user-id ACCOUNT_ID --role learner|teacher|admin")
	}
	if strings.TrimSpace(*userID) == "" || strings.TrimSpace(*userID) != *userID {
		return errors.New("an exact existing account ID is required")
	}
	if *role != "learner" && *role != "teacher" && *role != "admin" {
		return errors.New("role must be learner, teacher or admin")
	}
	if strings.TrimSpace(databaseURL) == "" {
		return errors.New("DATABASE_URL is required; roles cannot be assigned in memory mode")
	}
	st, err := open(databaseURL)
	if err != nil {
		return errors.New("could not open the configured account database")
	}
	defer st.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := st.SetUserRole(ctx, *userID, *role); err != nil {
		return errors.New("role was not confirmed; verify the account ID and database, then retry the same assignment")
	}
	_, err = fmt.Fprintf(output, "Account %s now has role %s.\n", *userID, *role)
	if err != nil {
		return errors.New("assignment completed but confirmation could not be written; retrying the same assignment is safe")
	}
	return nil
}
