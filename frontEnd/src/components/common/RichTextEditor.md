# RichTextEditor - Componente Reutilizável

Componente de editor de texto rico baseado em React Quill, totalmente reutilizável e configurável.

## Instalação

O componente já está instalado e pronto para uso. Certifique-se de que `react-quill` está instalado:

```bash
npm install react-quill
```

## Uso Básico

```jsx
import RichTextEditor from '../components/common/RichTextEditor';

function MeuComponente() {
  const [conteudo, setConteudo] = useState('');

  return (
    <RichTextEditor
      value={conteudo}
      onChange={setConteudo}
      placeholder="Digite seu texto aqui..."
    />
  );
}
```

## Props

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `value` | `string` | `''` | Valor HTML do editor (controlado) |
| `onChange` | `function` | **obrigatório** | Callback chamado quando o conteúdo muda. Recebe HTML string como parâmetro |
| `placeholder` | `string` | `'Digite o texto...'` | Texto placeholder do editor |
| `disabled` | `boolean` | `false` | Se `true`, desabilita o editor |
| `error` | `boolean` | `false` | Se `true`, aplica estilo de erro (borda vermelha) |
| `minHeight` | `number` | `300` | Altura mínima do editor em pixels |
| `showFloatingToolbar` | `boolean` | `true` | Se `true`, mostra toolbar flutuante ao selecionar texto |
| `className` | `string` | `''` | Classe CSS adicional para o wrapper |
| `id` | `string` | `undefined` | ID único para o componente (gerado automaticamente se não fornecido) |
| `onFocus` | `function` | `undefined` | Callback chamado quando o editor recebe foco |
| `onBlur` | `function` | `undefined` | Callback chamado quando o editor perde foco |

## Exemplos de Uso

### Uso Básico

```jsx
import RichTextEditor from '../components/common/RichTextEditor';

const [descricao, setDescricao] = useState('');

<RichTextEditor
  value={descricao}
  onChange={setDescricao}
  placeholder="Descreva aqui..."
/>
```

### Com Validação de Erro

```jsx
const [conteudo, setConteudo] = useState('');
const [erro, setErro] = useState(false);

<RichTextEditor
  value={conteudo}
  onChange={setConteudo}
  error={erro}
  placeholder="Digite o conteúdo..."
/>
```

### Editor Desabilitado

```jsx
<RichTextEditor
  value={conteudo}
  onChange={setConteudo}
  disabled={isSubmitting}
  placeholder="Aguarde..."
/>
```

### Altura Customizada

```jsx
<RichTextEditor
  value={conteudo}
  onChange={setConteudo}
  minHeight={500}
  placeholder="Editor maior..."
/>
```

### Sem Toolbar Flutuante

```jsx
<RichTextEditor
  value={conteudo}
  onChange={setConteudo}
  showFloatingToolbar={false}
  placeholder="Sem toolbar flutuante..."
/>
```

### Com Callbacks de Foco

```jsx
<RichTextEditor
  value={conteudo}
  onChange={setConteudo}
  onFocus={() => console.log('Editor focado')}
  onBlur={() => console.log('Editor perdeu foco')}
/>
```

### Com Classe CSS Customizada

```jsx
<RichTextEditor
  value={conteudo}
  onChange={setConteudo}
  className="meu-editor-customizado"
  placeholder="Editor customizado..."
/>
```

## Funcionalidades

### Toolbar Fixa (Sempre Visível)
- Seletor de fontes (incluindo Google Fonts)
- Botões A+ / A- (aumentar/diminuir fonte)
- Títulos (H1, H2, H3)
- Formatação: Negrito, Itálico, Sublinhado, Riscado
- Listas ordenadas e não ordenadas
- Subscrito e sobrescrito
- Indentação
- Cores de texto e fundo
- Alinhamento
- Links
- Citações e blocos de código
- Limpar formatação

### Toolbar Flutuante (Ao Selecionar Texto)
- A+ / A- (aumentar/diminuir fonte)
- Seletor de cor
- Negrito (B)
- Itálico (I)
- Link

## Formatação

O editor retorna HTML. Para exibir o conteúdo formatado, use:

```jsx
<div dangerouslySetInnerHTML={{ __html: conteudo }} />
```

Ou use uma biblioteca como `react-html-parser` ou `html-react-parser`:

```jsx
import parse from 'html-react-parser';

<div>{parse(conteudo)}</div>
```

## Notas

- O componente limpa automaticamente HTML vazio (`<p><br></p>` ou `<p></p>`) retornando string vazia
- A toolbar flutuante aparece automaticamente ao selecionar texto
- Todas as fontes do Google Fonts estão disponíveis e importadas automaticamente
- O componente é totalmente independente e pode ser usado em qualquer página

