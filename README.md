# Nódoa — notas conectadas com Firebase

Um editor de notas com formatação rica (títulos, fontes, tamanhos, cores,
destaque, listas, links, alinhamento, imagens — parecido com o Word), barra
de ferramentas fixa no topo, menções `@Nota` com autocomplete, grafo de
conexões, tags e pastas — sincronizado em tempo real entre seus aparelhos via
Firestore. Imagens são hospedadas na Cloudinary (plano gratuito).

## Arquivos

- `index.html`, `style.css`, `app.js` — o app em si (front-end puro, sem build).
- `firestore.rules` — regras de segurança das notas (cada usuário só acessa as suas).
- `firebase.json` / `.firebaserc` — configuração do Firebase Hosting, já
  apontando para o projeto `mirror-f753b`.

## Configurar a Cloudinary (upload de imagens)

O plano gratuito do Firebase não permite mais ativar o Storage, então as
imagens sobem para a Cloudinary (25GB grátis) em vez disso.

1. Crie uma conta grátis em [cloudinary.com](https://cloudinary.com).
2. No Dashboard, copie o **Cloud name** (aparece no topo).
3. Vá em **Settings → Upload**, role até "Upload presets" e clique em
   **Add upload preset**.
4. Mude **Signing Mode** para **Unsigned** e salve. Anote o nome do preset.
5. Abra `app.js` e preencha as duas constantes no topo do arquivo:
   ```js
   const CLOUDINARY_CLOUD_NAME = "SEU_CLOUD_NAME_AQUI";
   const CLOUDINARY_UPLOAD_PRESET = "SEU_UPLOAD_PRESET_AQUI";
   ```

## Publicar no Firebase Hosting

1. Instale a CLI do Firebase (se ainda não tiver):
   ```
   npm install -g firebase-tools
   ```
2. Faça login:
   ```
   firebase login
   ```
3. Dentro desta pasta, publique o site e as regras do Firestore:
   ```
   firebase deploy --only hosting,firestore:rules
   ```
4. O terminal vai mostrar a URL final, algo como
   `https://mirror-f753b.web.app`. Abra essa URL no celular e no PC — é a
   mesma conta, o mesmo banco de dados, sincronizado em tempo real.

## Antes de publicar, confirme no Console do Firebase

- **Authentication → Sign-in method**: o provedor **E-mail/senha** precisa
  estar ativado.
- **Firestore Database**: precisa existir (modo produção).

## Como usar

- **+ Nova nota** cria uma nota; o título fica editável no topo.
- A barra de ferramentas fica fixa no topo (só o texto rola por baixo dela),
  igual num processador de texto: título (parágrafo / título 1-3), fonte,
  tamanho da fonte, negrito/itálico/sublinhado, cor do texto, cor de destaque
  (marca-texto), link, alinhamento, listas (numerada/com marcadores), recuo
  e inserir imagem.
- **`@`** abre um menu de autocomplete com as notas existentes — digite
  `@Inte` pra ver sugestões como "Integral" ou "Interclasse". Selecione com
  clique, Enter ou Tab. Se não existir nenhuma nota com esse nome, aparece a
  opção de criar uma nova na hora.
- Clicar numa menção já inserida abre a nota linkada.
- **Pastas** e **tags** ficam na barra lateral e filtram a lista de notas.
- **Grafo** (topo direito) mostra todas as notas conectadas visualmente —
  arraste os nós, dê zoom, clique para abrir.
- Tudo salva sozinho (autosave ~0,5s depois que você para de digitar/formatar).

## Sobre o projeto

Como a página conversa diretamente com os servidores do Firebase (Firestore
e Authentication) e da Cloudinary, ela precisa rodar num domínio de verdade —
por isso vai no Firebase Hosting em vez de ficar hospedada dentro do Claude.
Uma vez publicada, funciona como qualquer site normal, no celular e no PC.
