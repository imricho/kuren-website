<!-- Original Kuren botanical composition: layered petals, stems and fine leaf veins. CC0; see assets-ORNAMENTS.md. -->
<template>
  <svg class="conv-bouquet" viewBox="0 0 220 220" aria-hidden="true" focusable="false">
    <g fill="none" stroke="var(--conv-sage-deep)" stroke-linecap="round" opacity=".8">
      <path d="M116 216C66 186 20 145 18 81M111 214C164 183 203 139 201 88M115 210C96 156 107 101 89 59" stroke-width="1.1" />
      <path d="M33 126C14 115 8 99 13 86C31 95 36 109 33 126ZM46 149C49 125 60 113 74 112C70 132 61 143 46 149ZM177 139C177 118 187 102 201 97C205 119 194 134 177 139ZM159 164C179 164 194 153 198 138C179 140 165 150 159 164Z" fill="var(--conv-sage)" stroke-width=".5" />
      <path d="M17 94L29 119M53 141L69 117M183 130L197 103M167 158L191 143" stroke-width=".6" />
      <path d="M27 62C20 53 26 43 32 48C36 38 45 45 41 53C45 63 33 69 27 62ZM195 83C185 77 188 66 194 67C199 58 209 67 204 74C207 83 200 87 195 83Z" fill="var(--conv-blush-deep)" stroke-width=".5" />
    </g>
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
          <g fill="var(--conv-cream-petal)" opacity=".7">
            <ellipse v-for="i in 5" :key="i" rx="6" ry="11" cy="-6" :transform="`rotate(${i * 72 + 40})`" />
          </g>
          <path d="M-7 3C-12-7 3-13 8-5C14 5 0 13-5 7C-9 1-1-4 3 0" fill="none" stroke="var(--conv-rose-deep)" stroke-width=".8" />
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
