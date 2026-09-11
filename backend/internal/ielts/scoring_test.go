package ielts

import "testing"

func TestPublishedAnchors(t *testing.T){cases:=[]struct{section,testType string;raw int;want float64}{{"listening","academic",16,5},{"listening","academic",23,6},{"listening","academic",30,7},{"listening","academic",35,8},{"reading","academic",15,5},{"reading","academic",23,6},{"reading","general",23,5},{"reading","general",35,7}};for _,tc:=range cases{got,err:=Objective(tc.section,tc.testType,tc.raw,40);if err!=nil{t.Fatal(err)};if got.Band!=tc.want{t.Fatalf("%s %d: got %.1f want %.1f",tc.section,tc.raw,got.Band,tc.want)}}}
func TestOverallRounding(t *testing.T){cases:=[]struct{values[4]float64;want float64}{{[4]float64{6.5,6.5,5,7},6.5},{[4]float64{6.5,6.5,5.5,6},6},{[4]float64{7,7,6.5,6.5},7}};for _,tc:=range cases{got,err:=Overall(tc.values[0],tc.values[1],tc.values[2],tc.values[3]);if err!=nil{t.Fatal(err)};if got!=tc.want{t.Fatalf("got %.1f want %.1f",got,tc.want)}}}
