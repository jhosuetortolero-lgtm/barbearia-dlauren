<div align="center">

<img src="public/logo-dlauren.png" alt="Barbearia D’Lauren" width="150">

# Barbearia D’Lauren — Desde 2017

**Site cinematográfico da Barbearia D’Lauren, no Brejo de Beberibe, Recife - PE.**<br>
Dois filmes controlados pela rolagem, agendamento direto no WhatsApp e acabamento de estúdio.

[**Ver o site ao vivo →**](https://jhosuetortolero-lgtm.github.io/barbearia-dlauren/)

![HTML5](https://img.shields.io/badge/HTML5-semântico-0A0A0B?style=flat-square&logo=html5&logoColor=C89B54)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-0A0A0B?style=flat-square&logo=tailwindcss&logoColor=C89B54)
![GSAP](https://img.shields.io/badge/GSAP_+_ScrollTrigger-3.12-0A0A0B?style=flat-square&logo=greensock&logoColor=C89B54)
![Lenis](https://img.shields.io/badge/Lenis-1.1-0A0A0B?style=flat-square&logoColor=C89B54)
![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-online-0A0A0B?style=flat-square&logo=github&logoColor=C89B54)

</div>

![Hero do site — Barbearia D’Lauren](docs/preview-hero.jpg)

---

## Sobre o projeto

A **Barbearia D’Lauren** atende o Brejo de Beberibe desde 2017, com corte masculino, degradê, barbaterapia e o **Primeiro Corte** infantil, conduzidos por **Betto e Vanessa Lauren**.

O site conta essa história como um filme: o visitante rola a página e controla, quadro a quadro, o vídeo do barbeiro em atendimento (abertura) e o vídeo da logo dourada (encerramento). No fim, um toque leva ao agendamento, que chega pronto no WhatsApp da casa.

## Destaques

| | |
|---|---|
| **Scroll-scrubbing duplo em `<canvas>`** | 94 frames no hero e 240 frames no encerramento, sincronizados com a rolagem (`scrub: 0.5`), com suporte a telas Retina (DPR até 2). |
| **Carregamento inteligente** | O preloader baixa apenas os frames do hero. Os frames da logo carregam em segundo plano assim que o visitante sai do hero (6 downloads simultâneos). |
| **CTA rastreado no vídeo** | O vídeo da logo já traz um botão "Agende seu Corte" gravado. A posição dele foi medida quadro a quadro e o botão real em HTML (clicável e acessível) o cobre durante todo o movimento de câmera. |
| **Agendamento no WhatsApp** | Formulário com serviço, profissional, dia e horário. Os horários seguem o funcionamento real e avisam quando o período é de maior procura (quinta à tarde e sexta). A mensagem já sai formatada para `wa.me`. |
| **Status "aberto agora"** | Calculado no fuso de Recife (UTC−3), com o dia de hoje destacado na tabela de horários. |
| **Movimento reduzido** | Com `prefers-reduced-motion`, o site troca as animações por quadros estáticos, sem perder conteúdo nem CTAs. |
| **Fusão perfeita com o fundo** | Os frames têm preto puro; o canvas usa composição `lighten` para fundi-los ao `#0A0A0B` da página, sem emenda visível. |

## Galeria

| Especialidades | Encerramento |
|---|---|
| ![Menu de serviços](docs/preview-servicos.jpg) | ![Showcase da logo com CTA](docs/preview-showcase.jpg) |
| **Agendamento & Localização** | **Footer** |
| ![Agendamento](docs/preview-agendamento.jpg) | ![Footer](docs/preview-footer.jpg) |

<p align="center"><img src="docs/preview-mobile.jpg" alt="Versão mobile" width="300"></p>

## Design system

| Token | Valor | Uso |
|---|---|---|
| Fundo | `#0A0A0B` | Preto carvão, fundido ao fundo dos frames |
| Superfície | `#131315` | Cards e painel de localização |
| Hairline | `rgba(255,255,255,0.08)` | Divisórias de 1px |
| Ouro fosco | `#C89B54` | Destaques, CTAs e numerais (com variação metálica nos acentos) |
| Texto | `#F4F1EA` / `#96948E` | Off-white quente / texto secundário |
| Títulos | **Bodoni Moda** | Didone de alto contraste, corte óptico ajustado para tela |
| Interface | **Plus Jakarta Sans** | Navegação, formulário, horários (`tabular-nums`) |

Animações com desaceleração orgânica (`power3.out` / `cubic-bezier(0.16, 1, 0.3, 1)`), sem `bounce` ou `elastic`.

## Estrutura

```
.
├── index.html                 # Página única, HTML semântico
├── assets/
│   ├── css/site.css           # Design system e layout
│   └── js/site.js             # Sequências de frames, cenas GSAP, Lenis, agendamento
├── public/
│   ├── logo-dlauren.png       # Logo (preloader, navbar, footer, favicon)
│   ├── frames-barber/         # 94 frames WebP 1920×1080 — hero
│   └── frames-logo/           # 240 frames WebP 1280×720 — encerramento
└── docs/                      # Imagens deste README e da prévia de compartilhamento
```

## Configuração

Tudo o que costuma mudar fica no topo de [`assets/js/site.js`](assets/js/site.js):

```js
const HERO_TOTAL_FRAMES = 94;          // arquivos em public/frames-barber/
const CLOSING_TOTAL_FRAMES = 240;      // arquivos em public/frames-logo/
const WHATSAPP_NUMBER = "5581986802197";

const HERO_SECTION_VH = 250;           // altura total da seção pinada (inclui a 1ª tela)
const CLOSING_SECTION_VH = 320;
```

Os horários de funcionamento ficam na constante `HOURS` do mesmo arquivo (e na tabela do `index.html`).

## Rodar localmente

Os frames são carregados por URL, então use um servidor local (abrir o arquivo direto também funciona, mas o servidor reproduz o comportamento real):

```bash
python -m http.server 8080
# ou
npx serve .
```

Depois acesse `http://localhost:8080`.

## Regenerar os frames

Com o [FFmpeg](https://ffmpeg.org/) instalado, a partir dos vídeos originais:

```bash
# Hero — barbeiro em atendimento
ffmpeg -i Barbeiro01.mp4 -vf "fps=24,scale=1920:-2:flags=lanczos" \
  -c:v libwebp -quality 82 -compression_level 6 -preset picture \
  public/frames-barber/frame_%04d.webp

# Encerramento — logo D’Lauren (resolução nativa 1280px)
ffmpeg -i Barbeiro02.mp4 -vf "fps=24,scale=1280:-2:flags=lanczos" \
  -c:v libwebp -quality 82 -compression_level 6 -preset picture \
  public/frames-logo/frame_%04d.webp
```

Se a quantidade de arquivos mudar, atualize `HERO_TOTAL_FRAMES` e `CLOSING_TOTAL_FRAMES`. Se o vídeo da logo for trocado, refaça também o rastreamento do botão (`CTA_TRACK`).

## Como funciona por dentro

- **Lenis + ScrollTrigger**: o Lenis é atualizado pelo `gsap.ticker` e repassa cada rolagem ao `ScrollTrigger.update`. As cenas são criadas depois que fontes e frames do hero carregam, e a página usa `scrollbar-gutter: stable` para que a largura medida pelos pins nunca mude.
- **Frames**: cada sequência mantém um cache de imagens decodificadas e, se um quadro ainda não chegou, desenha o mais próximo disponível.
- **Encerramento no celular**: a escala do vídeo é limitada pela largura para a logo caber inteira, e as bordas do quadro se dissolvem no fundo.
- **Sem JavaScript**: conteúdo, links e contato continuam acessíveis; o agendamento aponta direto para o WhatsApp.

## Créditos

Desenvolvido com muito **Red Bull Zero** por **Dev. Jhosue Tortolero** — **Jhosue Lab’s**.

Marca, logotipo, vídeos e imagens pertencem à **Barbearia D’Lauren**. O uso desses materiais fora deste site depende de autorização da barbearia.

<div align="center">

**Barbearia D’Lauren** · Av. Ver. Otacílio Azevedo — Brejo de Beberibe, Recife - PE · [@barbeariadlauren](https://www.instagram.com/barbeariadlauren/)

</div>
