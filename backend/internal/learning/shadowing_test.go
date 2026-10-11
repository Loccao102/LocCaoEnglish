package learning

import "testing"

func TestShadowingCatalogAndSelection(t *testing.T) {
	seen := map[string]bool{}
	for _, pack := range shadowingCatalog.Packs {
		excluded := []string{}
		for range pack.Items {
			item, label, err := PickShadowing(pack.CEFRLevel, pack.ID, "same-seed", excluded)
			if err != nil || item.Text == "" || label != pack.Label || seen[item.ID] {
				t.Fatal("invalid or repeated phrase", item, err)
			}
			again, _, _ := PickShadowing(pack.CEFRLevel, pack.ID, "same-seed", excluded)
			if again != item {
				t.Fatal("unstable selection")
			}
			seen[item.ID] = true
			excluded = append(excluded, item.ID)
		}
	}
	if len(seen) != 30 {
		t.Fatal("existing phrases lost", len(seen))
	}
	if _, _, err := PickShadowing("C2", "cefr-core", "x", nil); err == nil {
		t.Fatal("unsupported level")
	}
	if _, _, err := PickShadowing("B1", "fake-pack", "x", nil); err == nil {
		t.Fatal("unsupported pack")
	}
}
