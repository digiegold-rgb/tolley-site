"use client";
import { useState } from "react";
import { BUSINESS_WORKFLOWS } from "@/lib/business";
import styles from "@/app/business/business.module.css";

export function WorkflowPreview() {
  const [selected, setSelected] = useState(0);
  const flow = BUSINESS_WORKFLOWS[selected];
  return <div className={styles.preview}>
    <div className={styles.previewHeading}><span>A WORKFLOW, RECONNECTED</span><span>Illustrative example</span></div>
    <div className={styles.switches} role="group" aria-label="Explore example workflows">{BUSINESS_WORKFLOWS.map((w, i) => <button type="button" key={w.id} aria-pressed={selected === i} onClick={() => setSelected(i)}>{["Job paperwork", "Inventory", "Orders"][i]}</button>)}</div>
    <div className={styles.flow} aria-live="polite" aria-atomic="true">
      <div className={styles.inputCard}><span>WHAT COMES IN</span><strong>{flow.input}</strong><div className={styles.paperLines} aria-hidden="true"><i/><i/><i/></div></div>
      <div className={styles.connector} aria-hidden="true"/>
      <div className={styles.reviewCard}><span className={styles.check} aria-hidden="true">✓</span><div><small>YOUR REVIEW STEP</small><strong>{flow.review}</strong></div></div>
      <div className={styles.connector} aria-hidden="true"/>
      <div className={styles.outputCard}><span>READY FOR THE NEXT STEP</span><strong>{flow.output}</strong><small>One place to see what needs attention.</small></div>
    </div>
    <p className={styles.previewNote}>A possible workflow, tailored to your tools. Nothing here processes or sends real customer data.</p>
  </div>;
}
