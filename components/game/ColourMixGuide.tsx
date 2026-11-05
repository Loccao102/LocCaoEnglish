import styles from "./ColourMixGuide.module.css";

/** General ratio teaching; the current round's recipe stays behind its hint. */
export default function ColourMixGuide({ drops }: { drops: number }) {
  return <section className={styles.guide} aria-label="Paint mixing guide">
    <h3>One drop = one equal part</h3>
    <p>This round needs <strong>{drops} drops in total</strong>. Tap a paint more than once to add more of that colour, then choose Mix paint.</p>
    <div className={styles.examples} aria-label="Ratio examples">
      <div><strong>Red : White = 1 : 2</strong><span aria-label="One red drop and two white drops"><i className={styles.red}>R</i><i className={styles.white}>W</i><i className={styles.white}>W</i></span><small>1 red + 2 white · 3 equal parts</small></div>
      <div><strong>Red : White = 2 : 1</strong><span aria-label="Two red drops and one white drop"><i className={styles.red}>R</i><i className={styles.red}>R</i><i className={styles.white}>W</i></span><small>2 red + 1 white · 3 equal parts</small></div>
    </div>
    <p>The same colours in different amounts make a different mix. White makes a mix paler. These examples explain ratios; they are not the recipe for your current target.</p>
    <p>Drop order does not matter. Clear palette lets you start the mix again before submitting.</p>
    {drops > 2 ? <p>For this target’s exact recipe, use <strong>Recipe (−1★)</strong> after resuming. Opening it counts as assistance once this round. Reading this guide is free.</p>
      : <p>In Practice: red + yellow makes orange; yellow + blue makes green; red + blue makes purple; red + white makes pink.</p>}
  </section>;
}
