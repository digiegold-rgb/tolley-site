'use client';

/* RulesScreen — the Vater production rulebook (VATER-RULES.pdf).
 *
 * The PDF is served by /api/vater/rules behind the studio session gate;
 * this screen just frames it inline and offers a download. The document
 * itself is compiled from ~/vater-studio/VATER-RULES.md on the DGX and
 * committed as data/VATER-RULES.pdf — update the md, re-render, redeploy.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, SectionHeader, VBtn } from '../../primitives';

const PDF_URL = '/api/vater/rules';

export function RulesScreen(): React.ReactElement {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <SectionHeader
        icon="description"
        title="Rules"
        description="The numbered production rulebook — every standing rule for how Vater videos are made. Reference rules by number."
        actionLabel="Download PDF"
        onAction={() => {
          window.open(`${PDF_URL}?download=1`, '_blank');
        }}
      />
      <VCard style={{ flex: 1, minHeight: 640, padding: 0, overflow: 'hidden' }}>
        <iframe
          src={PDF_URL}
          title="Vater Rules"
          style={{
            width: '100%',
            height: '100%',
            minHeight: 640,
            border: 'none',
            borderRadius: JELLY_TOKENS.radius.md,
            background: t.hover,
          }}
        />
      </VCard>
    </div>
  );
}
