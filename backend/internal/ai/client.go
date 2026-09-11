package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

var ErrUnavailable = errors.New("ai service unavailable")

type Client struct { BaseURL string; HTTP *http.Client }

func New(baseURL string)*Client{return &Client{BaseURL:strings.TrimRight(baseURL,"/"),HTTP:&http.Client{Timeout:25*time.Second}}}

func (c *Client) Post(ctx context.Context,path string,input any,out any)error{
	body,err:=json.Marshal(input);if err!=nil{return err};req,err:=http.NewRequestWithContext(ctx,http.MethodPost,c.BaseURL+path,bytes.NewReader(body));if err!=nil{return err};req.Header.Set("Content-Type","application/json");resp,err:=c.HTTP.Do(req);if err!=nil{return fmt.Errorf("%w: %v",ErrUnavailable,err)};defer resp.Body.Close();if resp.StatusCode<200||resp.StatusCode>=300{return fmt.Errorf("%w: status %d",ErrUnavailable,resp.StatusCode)};return json.NewDecoder(resp.Body).Decode(out)
}
