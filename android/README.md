# 22 DRIVE — Android / Play Store

Esta pasta contém a configuração inicial para empacotar o 22 DRIVE como aplicativo Android usando uma Trusted Web Activity (TWA).

## Aplicação web
https://gisolput-sketch.github.io/22-drive/

## Identificador Android
br.com.22drive.app

## Arquivos
- twa-manifest.json — configuração da TWA
- .gitignore — evita publicar chaves e artefatos de assinatura
- README.md — instruções

## Próxima etapa
O projeto Android pode ser gerado com Bubblewrap em um computador que tenha Node.js e acesso à internet. A chave de assinatura **não deve ser enviada ao GitHub**.

Com Bubblewrap instalado:

    npx @bubblewrap/cli init --manifest https://gisolput-sketch.github.io/22-drive/manifest.json

Depois, revisar a configuração, gerar o projeto e compilar o AAB.

O AAB assinado é o arquivo que será enviado ao Google Play Console. A chave de assinatura deve ser guardada em local seguro e nunca commitada no repositório.

A documentação do Chrome descreve as tecnologias Android/Custom Tabs usadas para experiências web dentro de aplicativos Android.