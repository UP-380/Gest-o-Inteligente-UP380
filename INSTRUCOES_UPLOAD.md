# 📤 INSTRUÇÕES PARA UPLOAD NO GITHUB

## 🚀 MÉTODO RÁPIDO (Recomendado)

### **1. Execute o script automático:**

**Windows:**
- Clique duas vezes no arquivo: `UPLOAD_GITHUB.bat`
- Ou execute no terminal: `UPLOAD_GITHUB.bat`

O script vai fazer tudo automaticamente! ✅

---

## 📋 MÉTODO MANUAL (Passo a Passo)

Se preferir fazer manualmente, execute estes comandos **no diretório do projeto**:

### **1. Abrir terminal no diretório do projeto:**

```powershell
cd "C:\Users\Luiz Marcelo\Desktop\PROJETO GESTÃO DE GABINETE"
```

### **2. Inicializar Git (se ainda não foi):**

```bash
git init
```

### **3. Configurar remote:**

```bash
git remote remove origin
git remote add origin https://github.com/NebulumTechAssociation/Gest-o_Gabinete.git
```

### **4. Adicionar arquivos:**

```bash
git add .
```

### **5. Fazer commit:**

```bash
git commit -m "Sistema de Gestão de Gabinete - Upload inicial"
```

### **6. Enviar para GitHub:**

```bash
git push -u origin master
```

---

## 🔐 AUTENTICAÇÃO

Quando executar `git push`, o sistema vai pedir:

**Username:** Seu usuário do GitHub  
**Password:** ⚠️ **NÃO digite sua senha!** Cole o **TOKEN** do GitHub!

### **Como criar o TOKEN:**

1. Acesse: https://github.com/settings/tokens
2. Clique em **"Generate new token (classic)"**
3. Dê um nome (ex: "Token Gestão Gabinete")
4. Marque a permissão **`repo`**
5. Clique em **"Generate token"**
6. **COPIE O TOKEN** (você não verá de novo!)

---

## ✅ VERIFICAR SE FUNCIONOU

Acesse o repositório:
```
https://github.com/NebulumTechAssociation/Gest-o_Gabinete
```

Você deve ver todos os arquivos do projeto! 🎉

---

## 🆘 PROBLEMAS COMUNS

### **Erro: "Permission denied"**
- Você precisa ter permissão de escrita no repositório
- Peça ao dono da organização para te adicionar como colaborador

### **Erro: "Updates were rejected"**
```bash
git pull origin master --allow-unrelated-histories
git push origin master
```

### **Erro: "Support for password authentication was removed"**
- Use TOKEN, não senha!

---

## 📝 PRÓXIMAS ATUALIZAÇÕES

Depois do primeiro upload, para enviar novas mudanças:

```bash
git add .
git commit -m "Descrição das mudanças"
git push
```

---

**Pronto! Seu código está no GitHub!** 🚀

