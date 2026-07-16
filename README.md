# 📱 ImobiShare - Sistema de Gestão de Imóveis & Exportação Mobile

Este projeto é uma plataforma avançada de gestão de imóveis projetada com arquitetura híbrida (Web + Android + iOS) utilizando **React + Vite + TypeScript** e **Capacitor v6**.

A plataforma está totalmente configurada com uma pipeline profissional de CI/CD via **GitHub Actions** para gerar automaticamente pacotes nativos de produção assinados para **Android (APK e AAB)** e **iOS (IPA)** sempre que houver modificações enviadas ao repositório.

---

## 🚀 Como Iniciar o Desenvolvimento Local

### Pré-requisitos
Certifique-se de ter instalado em sua máquina:
* **Node.js** (versão 20 ou superior)
* **npm** (incluso com o Node.js)
* **Android Studio** (para desenvolvimento local de Android)
* **Xcode** (necessário apenas para desenvolvimento local de iOS no macOS)

### 1. Instalação das Dependências
Instale todos os pacotes npm necessários utilizando o comando:
```bash
npm install
```

### 2. Executar o Servidor de Desenvolvimento
Inicie o servidor local integrado (Vite + Express):
```bash
npm run dev
```
O aplicativo estará disponível em: [http://localhost:3000](http://localhost:3000)

### 3. Compilar a Web para os Apps Nativos
Antes de abrir ou rodar os emuladores nativos, sempre compile os arquivos web estáticos:
```bash
npm run build
```

---

## 🛠️ Como Compilar Localmente (Android & iOS)

### 🤖 Android (Local)
Para abrir o projeto Android nativo no Android Studio e compilar seu próprio APK/AAB localmente:

1. Sincronize os arquivos do web app com a pasta nativa Android:
   ```bash
   npx cap sync android
   ```
2. Abra o projeto no Android Studio:
   ```bash
   npx cap open android
   ```
3. No Android Studio, clique em **Build > Build Bundle(s) / APK(s) > Build APK(s)** para gerar o instalador local de testes.

### 🍏 iOS (Local - Apenas macOS)
Para abrir o projeto iOS nativo no Xcode e rodar no simulador ou dispositivo físico:

1. Sincronize os arquivos do web app com a pasta nativa iOS:
   ```bash
   npx cap sync ios
   ```
2. Abra o projeto no Xcode:
   ```bash
   npx cap open ios
   ```
3. No Xcode, selecione o dispositivo/simulador desejado e clique no botão **Run** (Play) para testar.

---

## ⛓️ Pipeline de CI/CD (GitHub Actions)

A pipeline automatizada definida em `.github/workflows/build-mobile.yml` executa validações de qualidade e compilações completas nativas. Ela é acionada automaticamente nos seguintes cenários:

1. **Push ou Pull Request na branch `main`:** Executa análise estática (Linter), verifica se o build web compila perfeitamente e realiza builds de verificação do Android e iOS (para garantir que nenhuma alteração quebre os aplicativos).
2. **Criação de tags de versão (ex: `v1.0.0` ou `v2.1.3`):** Executa os builds nativos de produção, assina digitalmente os aplicativos e os publica diretamente na aba **Releases** do seu GitHub.
3. **Criação de uma Release no painel do GitHub:** Executa os builds nativos completos de produção assinados e anexa automaticamente os artefatos `app-release.apk`, `app-release.aab` e `app-release.ipa` prontos para instalação e distribuição.

---

## 🔑 Configuração de GitHub Secrets (Assinaturas Digitais)

Para obter builds de produção assinados e prontos para publicação na **Google Play Store** e **Apple App Store**, você deve adicionar as seguintes credenciais à seção **Settings > Secrets and variables > Actions** do seu repositório do GitHub:

### 🤖 Segredos para Android (Google Play)

* `ANDROID_KEYSTORE_BASE64`: A chave Keystore (`.jks` ou `.keystore`) convertida para formato Base64.
  * Para obter o código em sua máquina local, execute:
    ```bash
    base64 -w 0 seu-arquivo-keystore.keystore
    ``` (no Linux/macOS) ou use um conversor similar no Windows.
* `ANDROID_KEYSTORE_PASSWORD`: A senha principal de acesso à sua Keystore.
* `ANDROID_KEY_ALIAS`: O alias (nome de identificação) da chave criada na Keystore.
* `ANDROID_KEY_PASSWORD`: A senha específica da chave criada na Keystore.

### 🍏 Segredos para iOS (App Store)

* `IOS_CERTIFICATE_BASE64`: O certificado de distribuição da Apple (`.p12`) exportado do seu chaveiro, codificado em Base64.
  * Para converter para Base64:
    ```bash
    base64 -i seu-certificado.p12 -o certificado_base64.txt
    ```
* `IOS_CERTIFICATE_PASSWORD`: A senha criada ao exportar o certificado de distribuição `.p12`.
* `IOS_PROVISIONING_PROFILE_BASE64`: O arquivo de perfil de provisionamento (`.mobileprovision`) correspondente ao App ID, baixado do painel do Apple Developer Console e codificado em Base64:
  ```bash
  base64 -i seu-perfil.mobileprovision -o perfil_base64.txt
  ```
* `IOS_EXPORT_OPTIONS_PLIST`: Arquivo `ExportOptions.plist` codificado em Base64 contendo as especificações de exportação para a App Store.

> ℹ️ **Design Resiliente de CI/CD:** Se esses segredos não estiverem configurados no repositório, a pipeline do GitHub Actions continuará funcionando com sucesso! Ela irá gerar builds de teste não assinados e empacotará os executáveis nativos com segurança, informando detalhadamente no console o que falta para obter a assinatura oficial.

---

## 📦 Como Publicar Novas Versões (Passo a Passo)

Sempre que concluir um lote de melhorias ou correções e desejar gerar novos instaladores para os corretores e clientes:

### Método 1: Via Tag no Git (Recomendado)
No terminal do seu projeto local, execute os seguintes comandos:

```bash
# 1. Crie uma tag com a versão desejada
git tag v1.0.0

# 2. Envie as alterações e a tag para o GitHub
git push origin main --tags
```

A pipeline começará a rodar imediatamente no GitHub. Assim que terminar, você verá os arquivos `app-release.apk`, `app-release.aab` e `app-release.ipa` anexados à nova tag na aba de Releases do GitHub.

### Método 2: Via Painel do GitHub
1. Vá até a página do seu repositório no GitHub.
2. No menu lateral direito, clique em **Releases** e em **Draft a new release**.
3. Escolha uma nova tag (ex: `v1.0.1`), insira um título, descreva as novidades e clique em **Publish release**.
4. O GitHub Actions gerará os artefatos de produção em minutos e os anexará àquela release de forma totalmente automática.

---

## ⚡ Otimizações Mobile Implementadas
* **Minificação de Código & Recursos (Android):** Configurado `minifyEnabled true` e `shrinkResources true` no Gradle para excluir recursos e pacotes de códigos não utilizados, diminuindo drasticamente o tamanho final do APK.
* **ProGuard Otimizado:** Implementadas regras do ProGuard exclusivas para o motor do Capacitor e carregamento dinâmico de scripts, garantindo que o Web View e as interfaces de plugins nativos fiquem intactos e rápidos.
* **Compressão Dinâmica de Fotos do Celular:** O seletor de arquivos no formulário de novos imóveis agora possui uma função inteligente de compactação no client-side em canvas. Fotos de alta resolução capturadas com a câmera do celular (com vários Megabytes) são otimizadas instantaneamente para JPEG de alta performance com tamanho reduzido (~80 a 120KB), mantendo a velocidade e a leveza do carregamento de imagens no app.
* **Textos WhatsApp Limpos e Otimizados:** Os textos de compartilhamento de imóveis individuais ou múltiplos pelo WhatsApp foram otimizados com fontes de estilo mono, garantindo que as mensagens sejam super curtas, limpas, atraentes e de rápida leitura para os clientes.
