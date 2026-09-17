# Nódoa — notas conectadas com Firebase

Um app de notas em Markdown com `[[wikilinks]]`, grafo de conexões, tags,
pastas e editor com preview lado a lado — sincronizado em tempo real entre
seus aparelhos via Firestore.

## Arquivos

- `index.html`, `style.css`, `app.js` — o app em si (front-end puro, sem build).
- `firestore.rules` — regras de segurança (cada usuário só acessa suas próprias notas).
- `firebase.json` / `.firebaserc` — configuração do Firebase Hosting, já
  apontando para o projeto `mirror-f753b`.

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
- Escreva em Markdown no editor à esquerda — o preview atualiza sozinho à direita.
- `[[Nome de outra nota]]` cria um link; clicando nele, abre a nota (ou cria
  uma nova com esse título, se ainda não existir).
- **Pastas** e **tags** ficam na barra lateral e filtram a lista de notas.
- **Grafo** (topo direito) mostra todas as notas conectadas visualmente —
  arraste os nós, dê zoom, clique para abrir.
- Tudo salva sozinho (autosave ~0,5s depois que você para de digitar).

## Sobre o projeto

Como a página conversa diretamente com os servidores do Firebase (Firestore
e Authentication), ela precisa rodar num domínio de verdade — por isso vai
no Firebase Hosting em vez de ficar hospedada dentro do Claude. Uma vez
publicada, funciona como qualquer site normal, no celular e no PC.
