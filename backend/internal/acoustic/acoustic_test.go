package acoustic

import (
	"encoding/base64"
	"encoding/binary"
	"math"
	"testing"
)

func wav() []byte {
	b := make([]byte, 76)
	copy(b, "RIFF")
	binary.LittleEndian.PutUint32(b[4:], uint32(len(b)-8))
	copy(b[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(b[16:], 16)
	binary.LittleEndian.PutUint16(b[20:], 1)
	binary.LittleEndian.PutUint16(b[22:], 1)
	binary.LittleEndian.PutUint32(b[24:], 16000)
	binary.LittleEndian.PutUint32(b[28:], 32000)
	binary.LittleEndian.PutUint16(b[32:], 2)
	binary.LittleEndian.PutUint16(b[34:], 16)
	copy(b[36:], "data")
	binary.LittleEndian.PutUint32(b[40:], 32)
	return b
}
func TestWAVBindingAndStrictLimits(t *testing.T) {
	b := wav()
	raw, s, e := DecodeWAV(base64.StdEncoding.EncodeToString(b))
	if e != nil || !ValidSample(s) || s.SHA256 != Hash(raw) || s.DurationSec != .001 {
		t.Fatal(s, e)
	}
	changes := []func([]byte) []byte{func(b []byte) []byte { return b[:len(b)-1] }, func(b []byte) []byte { b[22] = 2; return b }, func(b []byte) []byte { b[24] = 1; return b }, func(b []byte) []byte { b[34] = 8; return b }, func(b []byte) []byte { b[40] = 255; return b }, func(b []byte) []byte { b[4] = 0; return b }}
	for i, change := range changes {
		if _, _, e := DecodeWAV(base64.StdEncoding.EncodeToString(change(wav()))); e == nil {
			t.Fatal("bad WAV accepted", i)
		}
	}
	for _, encoded := range []string{"garbage", "data:audio/wav;base64," + base64.StdEncoding.EncodeToString(b), base64.StdEncoding.EncodeToString(make([]byte, MaxAudioBytes+1))} {
		if _, _, e := DecodeWAV(encoded); e == nil {
			t.Fatal("invalid encoding accepted")
		}
	}
	s.DurationSec = math.NaN()
	if ValidSample(s) {
		t.Fatal("NaN duration")
	}
}
func TestFeedbackRequiresExactEvidenceAndPreservesZero(t *testing.T) {
	zero := 0.0
	r := Receipt{Reference: "Hello", Sample: Sample{SHA256: Hash(wav())}}
	fixture := func() Feedback {
		return Feedback{Provider: Provider, Model: Model, MethodVersion: MethodVersion, Locale: "en-US", AudioSHA256: r.Sample.SHA256, ReferenceSHA256: Hash([]byte(r.Reference)), AcousticAssessment: true, Overall: &zero, Scores: map[string]*float64{"accuracy": &zero, "fluency": &zero, "completeness": &zero}, Coaching: []string{"Repeat slowly."}}
	}
	if e := Validate(fixture(), r); e != nil {
		t.Fatal("zero rejected", e)
	}
	for i, change := range []func(*Feedback){func(f *Feedback) { f.Overall = nil }, func(f *Feedback) { v := math.NaN(); f.Overall = &v }, func(f *Feedback) { f.AudioSHA256 = "different" }, func(f *Feedback) { f.ReferenceSHA256 = "different" }, func(f *Feedback) { f.Provider = "local-audio-quality" }, func(f *Feedback) { delete(f.Scores, "accuracy") }, func(f *Feedback) { f.Scores["textMatch"] = &zero }, func(f *Feedback) { f.AcousticAssessment = false }, func(f *Feedback) { f.Model = "invented" }, func(f *Feedback) { f.Coaching = []string{" "} }} {
		f := fixture()
		change(&f)
		if Validate(f, r) == nil {
			t.Fatal("invalid provider output", i)
		}
	}
}
