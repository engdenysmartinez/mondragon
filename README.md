# Mondragon — Almoxarifado digital

Protótipo web responsivo, em português, com a marca fornecida. JavaScript nativo; não exige instalação de pacotes. Node.js 22 ou superior.

## Testar agora

Na pasta do projeto, execute:

```powershell
node server.mjs
```

Abra http://localhost:4173 e clique em **Abrir demonstração**. O servidor atende somente neste computador. Para uso por outros dispositivos, publique a pasta `public` em uma hospedagem HTTPS.

1. Inicie uma separação. O primeiro número da demonstração é **000147**.
2. Informe projeto e estação, ou preencha-os após a primeira leitura.
3. Digite/bipe **BMA0006765** e pressione Enter.
4. Confira código, projeto, estação, quantidade e caixa; confirme a peça.
5. Crie caixas e use o lápis de cada item para editar ou remanejar.
6. Revise e confirme o romaneio. Caixas vazias impedem a confirmação.
7. Consulte o histórico, baixe CSV ou use Imprimir / PDF.

No modo de demonstração, Gabriela é uma identidade fictícia, os dados ficam no armazenamento local do navegador e nenhum e-mail é enviado. A demonstração não é autenticação e não deve receber informações sensíveis. O login real usa Supabase Auth. Recarregar a página retorna ao login, mantendo os dados salvos.

## QR code e leitores

O exemplo real fornecido, `BMA0006765`, é apenas o identificador. Projeto, estação e quantidade não podem ser deduzidos desse texto; no protótipo são preenchidos pelo usuário. Para consulta automática por BMA, é necessário fornecer e importar um cadastro de peças; essa importação não está implementada.

Também são aceitos QR codes com JSON:

```json
{"bma":"BMA0006765","projeto":"Projeto X","estacao":"Estação Y","quantidade":4}
```

Ou texto rotulado:

```text
BMA: BMA0006765; Projeto: Projeto X; Estação: Estação Y; Quantidade: 4
```

Leitores USB/Bluetooth devem operar como teclado, preferencialmente com sufixo Enter. A câmera usa a API nativa BarcodeDetector e requer suporte do navegador, HTTPS (ou localhost) e permissão de câmera. Quando indisponível, o sistema orienta usar leitor ou digitação. Leitura física por câmera não foi validada neste ambiente.

## Ativar o Supabase

O projeto e a chave **publishable** fornecidos já estão configurados em `public/api.js`. Essa chave é pública por definição; autorização depende de Auth, RLS e funções do banco. Nunca coloque service_role ou a chave Resend no frontend.

1. Acesse o projeto `skawydzwuroolpybrngl` no painel Supabase.
2. No projeto informado, `supabase/schema.sql` já foi aplicado em 05/10/2026. Não execute novamente nele. Para um projeto novo, execute **uma vez**, revisando conflitos antes de aplicar em um banco existente.
3. Em Authentication > Users, crie os usuários de teste com e-mail e senha.
4. Autorize cada usuário na tabela `app_members`, usando o UUID real de Authentication, o nome completo e o papel `operator` ou `admin`. Há um exemplo SQL comentado no fim do arquivo.
5. Entre com um administrador e cadastre os três destinatários em Configurações.

O banco gera a numeração sequencial, registra o responsável e a hora da leitura no servidor e preserva essas informações durante a edição. Apenas o proprietário edita seus rascunhos. Usuários autorizados podem consultar os romaneios da equipe. Após confirmar, o documento fica imutável pelas APIs de usuário. Os destinatários são congelados na confirmação.

## E-mail automático

A função `supabase/functions/send-manifest/index.ts` envia o conteúdo completo do romaneio via Resend. Ela verifica o JWT, a autorização do usuário, a propriedade e a confirmação do documento. Não aceita destinatários nem conteúdo arbitrário do navegador.

1. Configure um remetente/domínio verificado no Resend.
2. No Supabase, configure os segredos `RESEND_API_KEY`, `MAIL_FROM` (ex.: `Mondragon <almoxarifado@seu-dominio.com>`) e `APP_ORIGIN` (origem exata do frontend; para teste, `http://localhost:4173`). `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são variáveis do ambiente de funções Supabase.
3. Publique a função pelo painel ou pela CLI:

```text
supabase functions deploy send-manifest --project-ref skawydzwuroolpybrngl --no-verify-jwt
```

O handler faz sua própria validação do JWT com `/auth/v1/user`. A opção acima desativa apenas a verificação prévia do gateway, não a autenticação implementada na função.

Ao confirmar, o frontend chama a função automaticamente. Se houver falha de rede ou configuração, o romaneio permanece confirmado e o botão **Enviar e-mail** permite nova tentativa. `sent` significa aceito pelo provedor, não comprovação de entrega na caixa de entrada. Há chave de idempotência no Resend; sua janela de deduplicação é limitada pelo provedor. Não há worker de repetição automática: se o navegador fechar entre confirmar e enviar, reabra o romaneio e tente o envio. Antes de uso em produção, implemente uma fila/worker durável e monitore a entrega.

Documentação de referência: [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [envio de e-mail](https://supabase.com/docs/guides/functions/examples/send-emails) e [Resend](https://resend.com/docs/api-reference/emails/send-email).

## Verificação e limites

```powershell
node --test --test-isolation=none
```

Os testes cobrem leitura simples/estruturada, valores inválidos, remanejamento e validações de confirmação. O fluxo de demonstração foi exercitado no navegador com duas caixas e seis unidades, incluindo bloqueio de caixa vazia.

Em 05/10/2026, após autenticação nos painéis, os arquivos foram publicados em https://github.com/engdenysmartinez/mondragon. As três tabelas, suas políticas RLS e as quatro funções SQL foram instaladas e verificadas no Supabase. A Edge Function `send-manifest` também foi publicada. Os destinatários de teste foram cadastrados conforme solicitado. O usuário administrador ainda precisa ser criado no Supabase Auth e vinculado a `app_members`; o envio real exige os segredos do Resend. Login, persistência pelo aplicativo e entrega real de e-mail ainda não foram validados. A opção de verificação JWT legada deve ser revisada na ativação da função conforme a seção de e-mail, com autorização do administrador.

Este é um MVP para validação do fluxo: não faz baixa de estoque, integração ERP, assinatura eletrônica certificada, controle de concorrência entre múltiplas abas do mesmo usuário ou trilha completa de versões de edição. Os dados do modo real dependem da instalação do esquema acima.
