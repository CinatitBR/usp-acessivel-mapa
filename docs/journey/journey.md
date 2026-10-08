# Jornada do usuário — Mapa USP Butantã

Especificação para a apresentação interativa: um slide para cada tela + ação importante. Os rótulos entre aspas são os textos exatos da interface. Cada ponto de interação diz o elemento, o seu tipo e o slide a que ele leva (`→ Sxx`).

## Visão geral

**O que é.** Um mapa do campus Butantã da USP, pensado primeiro para o celular. Mostra prédios, unidades e locais, os ônibus com previsão ao vivo e a acessibilidade do campus: rampas, elevadores, entradas, banheiros e vagas. Para algumas unidades há também rotas visuais: o caminho para entrar ou circular no prédio, mostrado foto a foto. Quem passa pelo campus pode relatar um problema de acessibilidade; depois de revisado, o relato aparece no mapa de todos e as rotas sem degraus desviam dele.

**Quem usa.**
- **Pessoa em cadeira de rodas ou com mobilidade reduzida**: quer saber se um prédio é acessível, por onde entrar e que caminho não tem degraus nem bloqueios.
- **Visitante ou estudante**: quer achar um prédio, saber como chegar e quando passa o ônibus.
- **Revisor**: confere os relatos enviados e decide o que vai para o mapa.

**O layout que todas as telas compartilham.**
- **Mapa** ocupando a tela inteira, em 3D (prédios, árvores e ônibus).
- **Controles flutuantes** sobre o mapa: campo de busca, botão "Acessibilidade", "Camadas do mapa", "Traçar rota" e "Relatar um problema".
- **Painel inferior**: abre quando algo é selecionado. No celular fica sobre a parte de baixo do mapa e para em três alturas (só o cabeçalho, metade, tela cheia); arrasta-se pela alça ou toca-se nela ("Expandir painel" / "Recolher painel"). O "Fechar" (×) volta ao mapa. Em telas largas (a partir de 760 px) o painel fica ao lado do mapa.

As capturas usam o layout de celular.

## Mapa do fluxo

- **S01 Mapa inicial** é o ponto de partida de tudo.
- **A. Explorar**: S01 → S02 (busca) → S03 (prédio) ⇄ S04 (unidade); S01 → S05 (local); S01 → S06 (camadas).
- **B. Acessibilidade**: S01 → S07 (visão de acessibilidade) → S08 (ponto de acessibilidade) → S03.
- **C. Dentro de um prédio**: S03 → S09 (planta interna) → S10 (sala).
- **D. Rotas visuais**: S03 ou S04 → S11 (rota visual) → S12 (foto de um passo) → S11.
- **E. Ônibus**: S01 → S13 (ponto) → S14 (ônibus) → S13.
- **F. Rotas**: S01 ou qualquer painel com "Rota até aqui" → S15 → S16 → S17 / S18 → S23 (relato na rota).
- **G. Relatos**: S01, S03 ou S08 → S19 → S20 → S21 → S22; qualquer relato no mapa → S23 → S24.
- **H. Revisão**: `?revisar` → S25 → S26 → S27; S26 → S28. O que é publicado aqui é o que aparece em S23 e S18.
- **I. Quando algo dá errado**: S29 (sem conexão) e S30 (aparelho lento) podem acontecer em qualquer ponto.

---

## A. Explorar o campus

### S01 · Mapa inicial
- **Etapa/Objetivo:** orientar-se no campus e escolher por onde começar: procurar um lugar, ver a acessibilidade, traçar uma rota ou relatar um problema.
- **Ações e pontos de interação:**
  - Campo "Buscar prédio, instituto ou local" (campo de texto) → S02
  - "Acessibilidade" (botão liga/desliga) → S07
  - "Camadas do mapa" (botão redondo) → S06
  - "Traçar rota" (botão redondo) → S15
  - "Relatar um problema" (botão redondo, bandeira) → S19
  - Toque em um prédio (mapa) → S03
  - Toque no símbolo de um local (mapa) → S05
  - Toque em um ponto de ônibus (mapa) → S13
  - Toque em um ônibus em movimento (mapa) → S14
  - Toque em um aviso de relato (mapa) → S23
  - Arrastar, pinçar e girar (mapa): move a câmera; não muda de tela
- **Estado a capturar:** o aplicativo recém-aberto, com o campus inteiro à vista, nada selecionado e os ônibus ao vivo no mapa.
- **Captura:** `screenshots/s01-mapa.png`

### S02 · Busca
- **Etapa/Objetivo:** achar um lugar pelo nome, sem precisar saber onde ele fica.
- **Ações e pontos de interação:**
  - Digitar no campo (campo de texto): a lista de resultados aparece enquanto se digita; os do campus vêm primeiro
  - Resultado do campus (item da lista) → S03 se for um prédio, S04 se for uma unidade, S05 se for um local, S13 se for um ponto de ônibus; a câmera voa até o lugar
  - Resultado da seção "Fora do campus" (item da lista) → painel "Local fora do campus", que só oferece "Rota até aqui" → S15
  - "Limpar busca" (botão ×) → apaga o texto e mantém o campo pronto para digitar
  - Sem resultados: a lista mostra "Nenhum resultado no campus"
- **Estado a capturar:** o campo com "brasiliana" digitado e a lista aberta: três resultados do campus (um ponto de ônibus, uma estação de bicicletas e um prédio) e a seção "Fora do campus".
- **Captura:** `screenshots/s02-busca.png`

### S03 · Painel do prédio
- **Etapa/Objetivo:** saber o que é o prédio, se é acessível e o que fazer a partir dele.
- **Ações e pontos de interação:**
  - "Rota até aqui" (botão principal) → S15, com o prédio como destino
  - "Ver planta interna" (botão; só em prédios com planta, hoje o Edifício Vilanova Artigas) → S09
  - "Relatar" (botão) → S20, com o prédio já definido como lugar
  - "Site" (link) → abre o site do prédio ou da unidade em outra aba
  - Linha da unidade, por exemplo "FAU · Faculdade de Arquitetura e Urbanismo" (linha clicável) → S04
  - Fotos da Wikipédia (carrossel: "Foto anterior" / "Próxima foto") e "Ler na Wikipédia" (link externo)
  - Bloco "Acessibilidade": o status (Acessível, Parcialmente acessível, Não acessível ou Sem informação), banheiro acessível, elevador, vagas reservadas e a fonte da informação; só leitura
  - Item de "Rotas visuais" (cartão com a foto da chegada, o título da rota e "N passos"; logo abaixo do bloco "Acessibilidade", só quando a unidade do prédio tem rotas) → S11
  - Item de "Recursos neste prédio" (linha clicável) → S08
  - Item de "Relatos neste prédio" (linha clicável; só quando há relatos) → S23
  - "Fechar" (×) → S01
- **Estado a capturar:** o Edifício Vilanova Artigas (FAU) selecionado e destacado no mapa, com o painel na metade da tela mostrando os botões de ação e o começo do conteúdo.
- **Captura:** `screenshots/s03-predio.png`

### S04 · Painel da unidade
- **Etapa/Objetivo:** ver uma unidade (instituto, faculdade) como um todo e chegar a um dos seus prédios.
- **Ações e pontos de interação:**
  - "Rota até aqui" (botão principal) → S15, com a unidade como destino
  - "Site" (link) → abre o site da unidade em outra aba
  - Item de "Rotas visuais" (cartão com a foto da chegada, o título da rota e "N passos"; acima da lista "Prédios", só quando a unidade tem rotas) → S11
  - Item da lista "Prédios" (linha clicável) → S03 do prédio escolhido
  - Fotos e texto da Wikipédia, quando a unidade tem artigo
  - "Fechar" (×) → S01
- **Estado a capturar:** a Escola Politécnica (EP), que tem várias rotas visuais, com o painel em tela cheia mostrando a lista "Rotas visuais".
- **Captura:** `screenshots/s04-unidade.png`

### S05 · Painel de um local
- **Etapa/Objetivo:** saber o que é aquele local (restaurante, biblioteca, banco, bebedouro…), quando abre e se é acessível.
- **Ações e pontos de interação:**
  - "Rota até aqui" (botão principal) → S15, com o local como destino
  - "Site" (link) → abre o site do local em outra aba
  - "Em [nome do prédio]" (linha clicável; quando o local fica dentro de um prédio) → S03
  - "Horário" e bloco "Acessibilidade": só leitura
  - "Fechar" (×) → S01
- **Estado a capturar:** a Lanchonete do IME, com o marcador no mapa, o prédio em que fica, o horário e o status "Parcialmente acessível".
- **Captura:** `screenshots/s05-local.png`

### S06 · Menu de camadas
- **Etapa/Objetivo:** escolher o que o mapa desenha e deixá-lo mais leve se estiver lento.
- **Ações e pontos de interação:**
  - "Visualização 3D" (chave liga/desliga) → liga ou desliga árvores e ônibus em 3D; a escolha fica guardada no aparelho
  - "Avisos temporários" (chave liga/desliga) → mostra ou esconde os relatos temporários (obras, bloqueios, elevadores fora de serviço)
  - Categorias de "Locais no mapa" — Alimentação, Biblioteca, Banco, Banheiro… (botões de filtro) → mostram ou escondem cada tipo de local
  - "Camadas do mapa" de novo, ou a tecla Esc → fecha o menu e volta a S01
- **Estado a capturar:** o menu aberto sobre o mapa, com "Visualização 3D" e "Avisos temporários" ligados e algumas categorias selecionadas.
- **Captura:** `screenshots/s06-camadas.png`

---

## B. Visão de acessibilidade

### S07 · Visão de acessibilidade ativa
- **Etapa/Objetivo:** ver de uma vez o que é acessível no campus e onde estão rampas, elevadores, entradas e banheiros.
- **Ações e pontos de interação:**
  - "Acessibilidade" (botão liga/desliga) → desliga a visão e volta a S01
  - Legenda (só leitura): Acessível, Parcialmente acessível, Não acessível, Sem informação — as cores dos prédios e dos símbolos
  - Filtros "Mostrar no mapa" — Rampa, Elevador, Entrada, Banheiro, Estacionamento, Meio-fio, Escada (botões de filtro) → mostram ou escondem cada tipo de ponto
  - Toque em um ponto de acessibilidade (mapa) → S08
  - Toque em um prédio (mapa) → S03
  - Com a visão ligada, os locais comuns ficam ocultos e uma rota nova já começa como "Sem degraus" (S15)
- **Estado a capturar:** a visão ligada em volta da FFLCH, onde há prédios coloridos como "Parcialmente acessível" ao lado de prédios sem informação, com a legenda, os filtros e vários pontos (entradas, rampa, escadas, vaga).
- **Captura:** `screenshots/s07-acessibilidade.png`

### S08 · Painel de um ponto de acessibilidade
- **Etapa/Objetivo:** saber o estado de um ponto específico — uma rampa, um elevador, uma entrada — e avisar se ele não está como o mapa diz.
- **Ações e pontos de interação:**
  - "Relatar" (botão) → S21 direto se for um elevador ou um banheiro (só há um tipo de problema possível); S20 nos outros casos
  - "Em [nome do prédio]" (linha clicável) → S03
  - Status, observação, "Andar", fonte e "Verificado em": só leitura
  - "Fechar" (×) → S07
- **Estado a capturar:** o elevador ao lado do ponto "Odontologia" selecionado com a visão de acessibilidade ligada, o símbolo destacado no mapa.
- **Captura:** `screenshots/s08-ponto-acessibilidade.png`

---

## C. Dentro de um prédio

### S09 · Planta interna
- **Etapa/Objetivo:** ver o prédio por dentro, andar por andar, para achar uma sala, os banheiros, as rampas e os elevadores.
- **Ações e pontos de interação:**
  - Botões de andar (grupo "Andares", o mais alto em cima) → trocam o andar desenhado; o nome do andar aparece ao lado ("Nível 1" e o nome)
  - "Fechar planta interna" (botão ×) → o prédio volta a ser um bloco 3D; volta a S03
  - Toque em uma sala (mapa) → S10
  - Toque em um corredor ou no piso (mapa): não muda nada
  - Ao abrir a planta, o painel do prédio se recolhe para deixar o mapa livre
- **Estado a capturar:** a planta do Edifício Vilanova Artigas aberta no Nível 1 ("Biblioteca e Departamentos"), com os botões de andar visíveis e o painel recolhido.
- **Captura:** `screenshots/s09-planta-interna.png`

### S10 · Painel de uma sala
- **Etapa/Objetivo:** saber o que é a sala e em que andar fica.
- **Ações e pontos de interação:**
  - "Rota até aqui" (botão principal) → S15, com o prédio como destino (as rotas levam até o prédio, não até a sala)
  - "Em Edifício Vilanova Artigas" (linha clicável) → S03
  - Tipo da sala (Sala de aula, Biblioteca, Auditório…), nível e crédito da planta: só leitura
  - Trocar de andar ou "Fechar" (×) → S09
- **Estado a capturar:** a sala "Biblioteca" do Nível 1 selecionada e contornada na planta.
- **Captura:** `screenshots/s10-sala.png`

---

## D. Rotas visuais

Rotas enviadas por pessoas do campus e guardadas por unidade: uma sequência de fotos, cada uma com a sua instrução, que mostra como chegar, entrar ou circular em um prédio. Aparecem nos painéis do prédio (S03) e da unidade (S04).

### S11 · Rota visual
- **Etapa/Objetivo:** ver, foto a foto, como é o caminho — por onde entrar, onde fica a rampa ou o elevador — antes de ir até lá.
- **Ações e pontos de interação:**
  - Cabeçalho (só leitura): o título da rota e "Rota visual · N passos"
  - Link de volta com o nome do prédio ou a sigla da unidade (link, acima do título) → S03 ou S04, de onde a rota foi aberta
  - Lista de passos (só leitura): cada passo tem o número, a instrução (ou "Passo N", quando não há texto) e a foto
  - Foto de um passo (botão, "Ampliar a foto do passo N") → S12, aberta naquele passo
  - "Fechar" (×) → S01
  - Aberta a partir de um prédio, a rota mantém o prédio destacado no mapa
  - Se a rota não puder ser carregada: "Não foi possível abrir esta rota visual agora."
- **Estado a capturar:** a rota "Acesso Biênio via Estacionamento" da Escola Politécnica (3 passos), aberta a partir do painel da unidade, com o painel em tela cheia mostrando os primeiros passos com as fotos. Evitar unidades com rotas de teste (IME, IQ e ECA têm algumas).
- **Captura:** `screenshots/s11-rota-visual.png`

### S12 · Foto de um passo
- **Etapa/Objetivo:** olhar um passo de perto e percorrer o caminho passo a passo, com a foto ocupando a tela inteira.
- **Ações e pontos de interação:**
  - Foto ampliada com o número e a instrução do passo embaixo (só leitura)
  - "Próximo passo" (botão de seta à direita; também a seta → do teclado) → mostra o passo seguinte; desativado no último
  - "Passo anterior" (botão de seta à esquerda; também a seta ← do teclado) → mostra o passo anterior; desativado no primeiro
  - "Fechar" (botão ×), a tecla Esc ou um toque na área escura em volta da foto → S11
- **Estado a capturar:** o passo 2 da mesma rota, com a foto em tela cheia, a instrução embaixo e as duas setas ativas.
- **Captura:** `screenshots/s12-foto-passo.png`

---

## E. Ônibus

### S13 · Painel do ponto de ônibus
- **Etapa/Objetivo:** saber quais ônibus passam ali e em quanto tempo chega o próximo.
- **Ações e pontos de interação:**
  - "Rota até aqui" (botão principal) → S15, com o ponto como destino
  - Lista "Próximos ônibus": linha, destino, a marca "acessível" e o tempo ("agora", "3 min", ou o horário)
  - Os ônibus do campus (as linhas acompanhadas no mapa) aparecem sempre e vêm primeiro na lista, mesmo quando a SPTrans não dá previsão para eles naquele ponto; nesse caso o tempo é estimado e vem marcado com ≈
  - Nota (só leitura; quando há algum tempo com ≈): "Horários com ≈ são estimativas pela posição do ônibus no mapa."
  - Chegada com seta (linha clicável; só para ônibus que estão no mapa, com previsão ou com estimativa) → S14, acompanhando aquele ônibus
  - Aviso da origem dos dados (só leitura): "Previsão ao vivo", "Horário programado · sem ônibus previstos agora" ou "Horário programado · dados ao vivo indisponíveis"
  - "Linhas" (só leitura): as linhas que passam no ponto
  - "Fechar" (×) → S01
- **Estado a capturar:** o ponto "Educação" em um horário com ônibus circulando, com "Previsão ao vivo", os ônibus do campus no topo da lista, pelo menos uma chegada com seta e, se possível, uma com tempo estimado (≈).
- **Captura:** `screenshots/s13-ponto.png`

### S14 · Painel do ônibus
- **Etapa/Objetivo:** acompanhar um ônibus no mapa e saber quanto falta para ele chegar ao ponto.
- **Ações e pontos de interação:**
  - "Todas as chegadas" (link de volta; quando o ônibus foi aberto a partir de um ponto) → S13, com a câmera de volta exatamente onde estava antes de seguir o ônibus
  - "Detalhes da viagem" (link de volta; quando o ônibus foi aberto por "Seguir ônibus" nos detalhes de uma viagem de transporte público) → os detalhes da viagem (S15), com a câmera de volta onde estava
  - "Seguir veículo" (botão; aparece quando o acompanhamento está pausado) → a câmera volta a seguir o ônibus
  - Estado do acompanhamento (só leitura): "Posição ao vivo · seguindo" ou "Posição ao vivo · acompanhamento pausado"
  - Mover o mapa → pausa o acompanhamento
  - Linha do tempo "Pontos da linha": os pontos que já passaram ("Passou"), "Ônibus aqui", os próximos com horário estimado (≈) e "Seu ponto"
  - Nome de um ponto na linha do tempo (linha clicável) → a câmera vai até o ponto e o acompanhamento pausa
  - "Mostrar N pontos anteriores" / "Ocultar pontos anteriores" (botão) → abre ou fecha os pontos já passados
  - Acessibilidade do veículo, prefixo e idade da posição: só leitura
  - "Fechar" (×) → S01
- **Estado a capturar:** um ônibus aberto a partir de uma chegada do S13, com a câmera seguindo o veículo, a linha destacada no mapa e o começo da linha do tempo ("Passou", "Ônibus aqui").
- **Captura:** `screenshots/s14-onibus.png`

---

## F. Rotas

### S15 · Painel de rota, vazio
- **Etapa/Objetivo:** dizer de onde e para onde se quer ir, e que tipo de caminho serve.
- **Ações e pontos de interação:**
  - Campo "De" e campo "Para" (campos de texto) → S16
  - "Inverter origem e destino" (botão) → troca as duas pontas
  - "A pé" / "Sem degraus" / "Transporte" (abas, "Tipo de rota") → escolhem o tipo; "Sem degraus" já vem marcado se a visão de acessibilidade estiver ligada
  - Relógio (botão redondo ao lado das abas) → abre a escolha do horário: "Sair agora", "Sair às" ou "Chegar às", com data e hora
  - "Transporte" (aba) → lista as viagens de transporte público ("Escolha uma viagem"); um cartão abre "Detalhes da viagem", com a linha do tempo da viagem e o trajeto no mapa; "Seguir ônibus" (quando o ônibus da viagem está ao vivo no mapa) → S14; "Todas as viagens" volta à lista
  - "Fechar" (×) ou "Traçar rota" de novo → fecha a rota e volta a S01
  - Com as duas pontas escolhidas, a rota é calculada sozinha → S17 ou S18
  - Vindo de "Rota até aqui", o campo "Para" já chega preenchido e o painel abre com o campo "De" em edição, já oferecendo "Usar minha localização"
- **Estado a capturar:** o painel "Rota" recém-aberto por "Rota até aqui" no S03, com "Para" preenchido, o campo "De" já em edição mostrando "Usar minha localização", e as abas dos tipos de rota.
- **Captura:** `screenshots/s15-rota-vazia.png`

### S16 · Escolha de uma ponta da rota
- **Etapa/Objetivo:** escolher a origem ou o destino pelo nome ou pela própria localização.
- **Ações e pontos de interação:**
  - "Usar minha localização" (primeiro item da lista) → preenche a ponta com "Minha localização"; se o aparelho não a fornecer, aparece "Não foi possível obter sua localização."
  - Digitar (campo de texto) → sugestões do campus e, abaixo, "Fora do campus"
  - Sugestão (item da lista) → preenche a ponta; o foco passa para a outra ponta se ela ainda estiver vazia; com as duas preenchidas → S17 ou S18
  - No celular, o painel sobe para a tela cheia enquanto se digita, para o teclado não cobrir a lista
- **Estado a capturar:** o campo "De" em edição com "reitoria" digitado, a lista aberta com "Usar minha localização" em primeiro e sugestões do campus.
- **Captura:** `screenshots/s16-rota-ponta.png`

### S17 · Rota a pé
- **Etapa/Objetivo:** ver o caminho, quanto tempo leva e por onde passa.
- **Ações e pontos de interação:**
  - Resumo (só leitura): tempo e distância; a rota desenhada no mapa
  - Aviso "Atenção: esta rota passa por escadas." (só leitura; quando há escadas)
  - "Sem degraus" (aba) → recalcula sem escadas → S18
  - "Passo a passo" (lista, só leitura): as instruções, com a marca "escada" nos trechos com degraus
  - Campos "De" / "Para" e "Inverter origem e destino" → mudam a rota (S16)
  - Item de "N relatos nesta rota" (linha clicável; quando há) → S23
  - "Fechar" (×) → S01
- **Estado a capturar:** a rota "A pé" da Reitoria até a FFLCH - História e Geografia, que passa por escadas: o trajeto no mapa, tempo e distância, e o aviso de escadas.
- **Captura:** `screenshots/s17-rota-a-pe.png`

### S18 · Rota sem degraus
- **Etapa/Objetivo:** ir de um lugar a outro de cadeira de rodas, sem escadas e desviando do que foi relatado como bloqueado.
- **Ações e pontos de interação:**
  - Garantia (só leitura): "Rota sem degraus." ou, quando não dá para garantir, "Evita escadas quando possível, mas pode conter degraus."
  - Desvio (só leitura): "Rota desviando de 1 bloqueio relatado (+…)." — a rota contorna os relatos publicados que dizem que não dá para passar, e diz quanto o desvio acrescenta
  - Sem desvio possível (só leitura): "Há um bloqueio relatado nesta rota e não encontramos um caminho sem degraus que desvie dele."
  - Item de "N relatos nesta rota" (linha clicável) → S23; cada item diz o tipo, se dá para passar e a que distância do início fica (ou "no destino"); os relatos da rota aparecem maiores no mapa. Fechar o relato volta a esta tela. Um bloqueio do qual a rota já desviou não entra nesta lista
  - "A pé" (aba) → S17
  - "Passo a passo" (lista, só leitura)
  - "Fechar" (×) → S01
- **Estado a capturar:** a mesma rota em "Sem degraus", com um relato de "Passagem bloqueada" publicado no caminho habitual pela Praça do Relógio: o trajeto contorna o aviso no mapa e o painel mostra "Rota sem degraus." e "Rota desviando de 1 bloqueio relatado (+50 m).".
- **Captura:** `screenshots/s18-rota-sem-degraus.png`

---

## G. Relatar um problema

### S19 · Relato, passo 1: "Onde está o problema?"
- **Etapa/Objetivo:** indicar o lugar do problema, sem digitar nada.
- **Ações e pontos de interação:**
  - Toque no mapa → marca o lugar e segue: S20 (ou S21, se o toque foi em um elevador ou banheiro acessível, onde só há um tipo de problema). Um novo toque muda o lugar
  - "Usar minha localização" (botão) → usa a posição do aparelho como lugar → S20
  - Toque fora do campus → aviso "Esse lugar fica fora do campus."; continua nesta tela
  - "Fechar" (×) ou "Relatar um problema" de novo → cancela e volta a S01
- **Estado a capturar:** o painel "Onde está o problema?" aberto, com o texto "Toque no mapa onde está o problema. Um novo toque muda o lugar." e nenhum lugar marcado ainda.
- **Captura:** `screenshots/s19-relato-onde.png`

### S20 · Relato, passo 2: "O que há de errado?"
- **Etapa/Objetivo:** dizer que tipo de problema é, escolhendo entre poucas opções com exemplos.
- **Ações e pontos de interação:**
  - Opções para um ponto em um caminho (botões grandes): "Passagem bloqueada", "Degrau ou falta de rampa", "Calçada estreita" → S21
  - Opções para um prédio (botões grandes): "Passagem bloqueada", "Degrau ou falta de rampa", "Elevador", "Banheiro acessível" → S21
  - "Onde está o problema?" (link de volta; não aparece quando o relato começou em "Relatar" de um painel) → S19
  - Toque em outro lugar do mapa → muda o lugar sem sair desta tela
  - "Fechar" (×) → cancela e volta a S01
- **Estado a capturar:** um ponto marcado na calçada da Avenida Professor Luciano Gualberto ("Ponto no mapa"), com as opções de caminho e seus exemplos visíveis.
- **Captura:** `screenshots/s20-relato-o-que.png`

### S21 · Relato, passo 3: a pergunta e o envio
- **Etapa/Objetivo:** responder a uma única pergunta e enviar.
- **Ações e pontos de interação:**
  - Para passagem, degrau ou calçada: "Dá para passar de cadeira de rodas?" → "Sim" / "Só com ajuda" / "Não" (botões de escolha)
  - Para elevador ou banheiro: "Qual é a situação?" → "Não funciona" / "Não existe" (elevador) ou "Interditado" / "Não existe" (banheiro)
  - "Adicionar observação" (linha clicável) → abre o campo "Observação (opcional)", de até 280 caracteres
  - Resumo (só leitura): tipo, resposta e lugar, logo acima do botão
  - "Enviar" (botão principal; fica ativo depois da resposta) → S22
  - "O que há de errado?" (link de volta) → S20
  - Aviso de privacidade (só leitura): "O relato é anônimo: enviamos o lugar, o tipo e a observação. Ele aparece no mapa depois de revisado."
  - Problemas no envio: "Não foi possível enviar este relato." ou "Muitos relatos em pouco tempo. Tente de novo em um minuto."
- **Estado a capturar:** "Passagem bloqueada" com a resposta "Não" marcada, uma observação curta digitada e o botão "Enviar" ativo.
- **Captura:** `screenshots/s21-relato-envio.png`

### S22 · Depois do envio: "Seu relato"
- **Etapa/Objetivo:** ter certeza de que o relato foi recebido e entender que ele ainda não é público.
- **Ações e pontos de interação:**
  - Mensagem de confirmação (só leitura, some sozinha): "Relato enviado. Ele aparece no mapa depois de revisado."
  - O relato fica no mapa do próprio usuário, com um símbolo vazado, só neste aparelho
  - Toque no símbolo (mapa) → painel "Seu relato", com "Aguardando revisão. Por enquanto só aparece neste aparelho."
  - "Remover do meu mapa" (linha clicável) → tira o relato do aparelho e volta a S01
  - "Em [nome do prédio]" (linha clicável; quando o relato é de um prédio) → S03
  - Quando um revisor publica o relato (S27), o símbolo vazado dá lugar ao aviso público → S23
- **Estado a capturar:** o painel "Seu relato" aberto sobre o símbolo vazado, com o texto "Aguardando revisão…".
- **Captura:** `screenshots/s22-seu-relato.png`

### S23 · Painel de um relato publicado
- **Etapa/Objetivo:** saber qual é o problema naquele lugar, se ainda vale e, estando ali, dizer se continua igual.
- **Ações e pontos de interação:**
  - Título e subtítulo (só leitura): por exemplo "Passagem bloqueada" · "Relato de quem passou por aqui"
  - Situação (só leitura): "Dá para passar", "Só com ajuda" ou "Não dá para passar"; a nota pública; as datas ("Relatado em…", "confirmado em…", "vale até…")
  - "Continua assim" (botão) → confirma o relato; aparece "Obrigado. Sua resposta ajuda a manter o mapa em dia." Um relato temporário confirmado fica mais tempo no mapa
  - "Mudou" (botão) → S24
  - "Em [nome do prédio]" (linha clicável) → S03
  - Marca "Pode ter mudado" (só leitura): aparece quando alguém já disse que mudou e um revisor ainda não conferiu
  - "Fechar" (×) → volta de onde veio: S01, S03 ou a rota (S17/S18)
  - Cada pessoa responde uma vez por dia sobre cada relato
  - Se o relato expirou ou foi retirado com o painel aberto: "Este relato não está mais no mapa"
- **Estado a capturar:** o relato publicado de "Passagem bloqueada" na Praça do Relógio, com "Não dá para passar", a nota pública, as datas e os botões "Continua assim" e "Mudou".
- **Captura:** `screenshots/s23-relato-publicado.png`

### S24 · "O que mudou?"
- **Etapa/Objetivo:** avisar que o relato já não corresponde ao que está no lugar.
- **Ações e pontos de interação:**
  - "Foi resolvido" / "Está diferente" (botões de escolha)
  - "Observação (opcional)" (campo de texto, até 280 caracteres)
  - "Enviar" (botão principal; ativo depois da escolha) → mensagem "Obrigado. Sua resposta ajuda a manter o mapa em dia."; o relato passa a mostrar "Pode ter mudado" e entra na fila do revisor (S28)
  - "Cancelar" (botão) → S23
  - Nada sai do mapa sem um revisor: a resposta só marca o relato e avisa quem revisa
- **Estado a capturar:** a pergunta "O que mudou?" com "Foi resolvido" marcado e uma observação curta.
- **Captura:** `screenshots/s24-o-que-mudou.png`

---

## H. Revisão de relatos (`?revisar`)

Página separada do mapa, para quem revisa. Abre no endereço do aplicativo com `?revisar` e é uma coluna simples de cartões, que também funciona no celular.

### S25 · Entrada do revisor
- **Etapa/Objetivo:** entrar na página de revisão.
- **Ações e pontos de interação:**
  - "Senha de revisão" (campo de senha)
  - "Entrar" (botão principal) → S26; com a senha errada, "Senha incorreta." e continua nesta tela
  - A senha fica guardada no aparelho até o revisor tocar em "Sair"
- **Estado a capturar:** a página "Revisão de relatos" com o campo de senha vazio.
- **Captura:** `screenshots/s25-revisao-entrada.png`

### S26 · Relatos pendentes
- **Etapa/Objetivo:** ver o que chegou e decidir o destino de cada relato.
- **Ações e pontos de interação:**
  - Cartão de cada relato (só leitura): o tipo, se dá para passar, o lugar, "Relatado em" com data e hora, e a "Observação de quem relatou (não é pública)"
  - "Ver no mapa" (botão) → abre o mapa no lugar do relato, em outra aba
  - "Publicar" (botão principal) → S27
  - "Duplicado" (botão) → tira o relato da fila, por já existir outro igual
  - "Recusar" (botão) → tira o relato da fila
  - "Sair" (botão, no cabeçalho) → S25
  - Sem pendências: "Nenhum relato aguardando revisão."
- **Estado a capturar:** a seção "Pendentes (2)" com dois cartões, um deles com observação de quem relatou.
- **Captura:** `screenshots/s26-revisao-pendentes.png`

### S27 · Confirmação da publicação
- **Etapa/Objetivo:** definir até quando o relato vale e o que o público vai ler, antes de publicar.
- **Ações e pontos de interação:**
  - "Vale até" (campo de data, opcional) — sem data, vale a regra: "Sem data, um bloqueio vale 7 dias e um elevador ou banheiro fora de serviço, 14. Os outros ficam no mapa."
  - "Nota pública" (campo de texto) — vem preenchida com a observação de quem relatou, para o revisor editar ou apagar
  - "Confirmar publicação" (botão principal) → o relato vai para o mapa de todos (S23) e passa a contar nas rotas (S18); o cartão vai para "Publicados" (S28)
  - "Cancelar" (botão) → S26
- **Estado a capturar:** um cartão pendente depois de "Publicar", com os campos "Vale até" e "Nota pública" abertos e preenchidos.
- **Captura:** `screenshots/s27-revisao-publicar.png`

### S28 · Mudanças relatadas e publicados
- **Etapa/Objetivo:** manter em dia o que já está no mapa, começando pelo que as pessoas disseram que mudou.
- **Ações e pontos de interação:**
  - Seção "Mudanças relatadas" (aparece primeiro, só quando há): em cada cartão, a lista do que foi dito — "Foi resolvido" ou "Está diferente", com data e observação
  - "Retirar do mapa" (botão) → o relato sai do mapa de todos
  - "Manter no mapa" (botão; só em cartões com mudanças relatadas) → o relato fica e a marca "Pode ter mudado" some
  - "Vale até" e "Nota pública" (campos) + "Salvar" (botão principal; ativo quando algo foi alterado) → atualizam o relato publicado
  - Em cada cartão (só leitura): "No mapa até…" ou "No mapa sem data para sair.", e "Confirmado por quem passou em…"
  - "Ver no mapa" (botão) → abre o mapa no lugar do relato, em outra aba
- **Estado a capturar:** a seção "Mudanças relatadas (1)" com um cartão marcado "Foi resolvido", seguida do começo de "Publicados".
- **Captura:** `screenshots/s28-revisao-publicados.png`

---

## I. Quando algo dá errado

Dois slides curtos, fáceis de cortar se a apresentação precisar ser menor.

### S29 · Sem conexão
- **Etapa/Objetivo:** continuar usando o mapa sem internet e não perder um relato.
- **Ações e pontos de interação:**
  - Linha de status sobre o mapa (só leitura): "Sem conexão · ônibus ao vivo indisponíveis"
  - O mapa, a busca no campus e os painéis de prédios continuam funcionando com o que já está no aparelho
  - No painel do ponto (S13): "Sem conexão. As previsões voltam quando a internet voltar."
  - No painel de rota (S15): "Sem conexão. Rotas precisam de internet."
  - As rotas visuais (S11) precisam de internet: sem conexão, a lista "Rotas visuais" só aparece se já tiver sido carregada antes
  - "Enviar" em um relato (S21) → "Sem conexão. O relato ficou guardado e será enviado quando a internet voltar."; no painel "Seu relato", "Ainda não enviado: será enviado quando a internet voltar."; o envio acontece sozinho quando a conexão volta
- **Estado a capturar:** o mapa sem conexão, com a linha de status visível e o painel "Seu relato" de um relato ainda não enviado.
- **Captura:** `screenshots/s29-sem-conexao.png`

### S30 · Aparelho lento: modo leve
- **Etapa/Objetivo:** manter o mapa fluido em aparelhos mais fracos, sem que a pessoa precise mexer em nada.
- **Ações e pontos de interação:**
  - Mensagem automática (aparece quando o 3D deixa o mapa lento): "Modo leve ativado para o mapa ficar mais fluido."
  - "Desfazer" (botão na mensagem) → volta ao 3D
  - "Visualização 3D" no menu de camadas (S06) → muda a escolha a qualquer momento; uma escolha feita pela pessoa nunca é desfeita pelo aplicativo
  - Outra mensagem do mesmo tipo: "Há uma nova versão do mapa." com "Atualizar" (botão) → recarrega o aplicativo
- **Estado a capturar:** o mapa sem árvores e com ônibus planos, com a mensagem "Modo leve ativado…" e o botão "Desfazer".
- **Captura:** `screenshots/s30-modo-leve.png`
