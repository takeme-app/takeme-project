# Ícones dos marcadores do mapa (Android)

Estes PNGs são usados como ícones dos marcadores no **Android** (Google Maps). No iOS continuam os ícones customizados em código.

## Tamanhos

- **marker-my-location.png** e **marker-driver.png**: 48×48 px (base)
- **marker-my-location@2x.png** e **marker-driver@2x.png**: 96×96 px (telas de alta densidade)

O React Native escolhe automaticamente a versão @2x em dispositivos com densidade maior.

## Como personalizar

1. **Substituir pelos seus ícones**  
   Edite ou troque os arquivos nesta pasta mantendo os **mesmos nomes** e **tamanhos** (48×48 e 96×96). Assim o mapa continua exibindo no tamanho certo.

2. **Usar imagens maiores como base**  
   Coloque seus PNGs (ex.: 192×192) em `apps/cliente/assets/` com os nomes:
   - `marker-my-location.png`
   - `marker-driver.png`  
   Na raiz do projeto rode:
   ```bash
   npm run resize-map-markers
   ```
   O script gera de novo os arquivos 48×48 e 96×96 nesta pasta.

## Conteúdo atual

- **marker-my-location**: círculo azul (sua localização)
- **marker-driver**: círculo preto com ícone de carro (motoristas/viagens)
