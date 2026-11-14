<!-- Corner bouquet composed from three sprigs (original artwork). -->
<template>
  <svg class="conv-bouquet" viewBox="0 0 220 220" aria-hidden="true" focusable="false">
    <g transform="rotate(-38 110 210)">
      <svg x="50" y="40" width="120" height="170" viewBox="0 0 120 170">
        <path d="M60 168 C56 130 66 96 60 52" fill="none" stroke="var(--conv-sage)" stroke-width="2" />
        <path d="M60 116 C42 112 30 98 30 84 C46 86 58 98 60 116Z" fill="var(--conv-sage)" />
        <path d="M61 96 C78 92 90 80 92 66 C76 66 63 78 61 96Z" fill="var(--conv-sage)" opacity=".8" />
        <g transform="translate(60 38)">
          <ellipse v-for="i in 5" :key="i" rx="9" ry="15" cy="-12" fill="var(--conv-blush-deep)" :transform="`rotate(${i * 72})`" />
          <circle r="6" fill="var(--conv-gold)" />
        </g>
      </svg>
    </g>
    <g transform="rotate(4 110 210)">
      <svg x="50" y="10" width="120" height="200" viewBox="0 0 120 170">
        <path d="M60 168 C56 130 66 96 60 52" fill="none" stroke="var(--conv-sage-deep)" stroke-width="2" />
        <path d="M60 126 C42 122 30 108 30 94 C46 96 58 108 60 126Z" fill="var(--conv-sage-deep)" opacity=".85" />
        <path d="M61 104 C78 100 90 88 92 74 C76 74 63 86 61 104Z" fill="var(--conv-sage)" />
        <g transform="translate(60 38)">
          <ellipse v-for="i in 5" :key="i" rx="11" ry="17" cy="-13" fill="var(--conv-rose)" :transform="`rotate(${i * 72 + 18})`" />
          <circle r="7" fill="var(--conv-gold)" />
        </g>
      </svg>
    </g>
    <g transform="rotate(40 110 210)">
      <svg x="50" y="50" width="110" height="160" viewBox="0 0 120 170">
        <path d="M60 168 C56 130 66 96 60 52" fill="none" stroke="var(--conv-sage)" stroke-width="2" />
        <path d="M59 120 C46 118 38 108 37 98 C49 100 57 108 59 120Z" fill="var(--conv-sage)" />
        <g transform="translate(60 40)">
          <ellipse v-for="i in 5" :key="i" rx="8" ry="13" cy="-10" fill="var(--conv-cream-petal)" :transform="`rotate(${i * 72})`" />
          <circle r="5" fill="var(--conv-gold)" />
        </g>
      </svg>
    </g>
  </svg>
</template>
