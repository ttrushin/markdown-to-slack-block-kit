import {
  DividerBlock,
  HeaderBlock,
  ImageBlock,
  KnownBlock,
  SectionBlock,
} from '@slack/types';
import { ListOptions, ParsingOptions } from '../types';
import { section, divider, header, image } from '../slack';
import { Token, Tokens, TokensList } from 'marked';
import { XMLParser } from 'fast-xml-parser';

type PhrasingToken =
  | Tokens.Link
  | Tokens.Em
  | Tokens.Strong
  | Tokens.Del
  | Tokens.Br
  | Tokens.Image
  | Tokens.Codespan
  | Tokens.Text
  | Tokens.HTML;

function parsePlainText(element: PhrasingToken): string[] {
  switch (element.type) {
    case 'link':
    case 'em':
    case 'strong':
    case 'del':
      return element.tokens.flatMap(child =>
        parsePlainText(child as PhrasingToken),
      );

    case 'br':
      return [];

    case 'image':
      return [element.title ?? element.href];

    case 'codespan':
    case 'text':
    case 'html':
      return [element.raw];
  }
}

function isSectionBlock(block: KnownBlock): block is SectionBlock {
  return block.type === 'section';
}

function parseMrkdwn(element: Exclude<PhrasingToken, Tokens.Image>): string {
  switch (element.type) {
    case 'link': {
      return `<${element.href}|${element.tokens
        .flatMap(child => parseMrkdwn(child as typeof element))
        .join('')}> `;
    }

    case 'em': {
      return `_${element.tokens
        .flatMap(child => parseMrkdwn(child as typeof element))
        .join('')}_`;
    }

    case 'codespan':
      return `\`${element.text}\``;

    case 'strong': {
      return `*${element.tokens
        .flatMap(child => parseMrkdwn(child as typeof element))
        .join('')}*`;
    }

    case 'text':
      return element.text;

    case 'del': {
      return `~${element.tokens
        .flatMap(child => parseMrkdwn(child as typeof element))
        .join('')}~`;
    }

    default:
      return '';
  }
}

function addMrkdwn(
  content: string,
  accumulator: (SectionBlock | ImageBlock)[],
) {
  const last = accumulator[accumulator.length - 1];

  if (last && isSectionBlock(last) && last.text && last.text.text && last.text.text.length + content.length <= 3000) {
    last.text.text += content;
  } else {
    accumulator.push(section(content));
  }
}

function parsePhrasingContentToStrings(
  element: PhrasingToken,
  accumulator: string[],
) {
  if (element.type === 'image') {
    accumulator.push(element.href ?? element.title ?? element.text ?? 'image');
  } else {
    const text = parseMrkdwn(element);
    accumulator.push(text);
  }
}

function parsePhrasingContent(
  element: PhrasingToken,
  accumulator: (SectionBlock | ImageBlock)[],
) {
  if (element.type === 'image') {
    const imageBlock: ImageBlock = image(
      element.href,
      element.text || element.title || element.href,
      element.title ?? undefined,
    );
    accumulator.push(imageBlock);
  } else {
    const text = parseMrkdwn(element);
    addMrkdwn(text, accumulator);
  }
}

function parseParagraph(element: Tokens.Paragraph): KnownBlock[] {
  return element.tokens.reduce(
    (accumulator, child) => {
      parsePhrasingContent(child as PhrasingToken, accumulator);
      return accumulator;
    },
    [] as (SectionBlock | ImageBlock)[],
  );
}

function parseHeading(element: Tokens.Heading): HeaderBlock {
  return header(
    element.tokens
      .flatMap(child => parsePlainText(child as PhrasingToken))
      .join(''),
  );
}

function parseCode(element: Tokens.Code): SectionBlock {
  return section(`\`\`\`\n${element.text}\n\`\`\``);
}

function parseList(
  element: Tokens.List,
  options: ListOptions = {},
): SectionBlock {
  let index = 0;
  const contents = element.items.map(item => {
    const parts: string[] = [];

    // Process all tokens in the list item
    item.tokens.forEach(token => {
      if (token.type === 'text') {
        // Handle text tokens
        const textToken = token as Tokens.Text;
        if (textToken.tokens?.length) {
          const text = textToken.tokens
            .filter(
              (child): child is Exclude<PhrasingToken, Tokens.Image> =>
                child.type !== 'image',
            )
            .flatMap(parseMrkdwn)
            .join('');
          parts.push(text);
        } else {
          parts.push(textToken.text || '');
        }
      } else if (token.type === 'list') {
        // Handle nested lists recursively
        const nestedListBlock = parseList(token as Tokens.List, options);
        if (nestedListBlock.text?.text) {
          // Indent the nested list content
          const indentedList = nestedListBlock.text.text
            .split('\n')
            .map(line => (line ? `  ${line}` : line))
            .join('\n');
          parts.push('\n' + indentedList);
        }
      } else if (token.type === 'paragraph') {
        // Handle paragraph tokens that might appear in list items
        const paragraphBlocks = parseParagraph(token as Tokens.Paragraph);
        const paragraphText = paragraphBlocks
          .filter(isSectionBlock)
          .map(block => block.text?.text || '')
          .join('');
        parts.push(paragraphText);
      }
      // Add other token types as needed
    });

    const itemContent = parts.join('').trim();

    // Apply list formatting
    if (element.ordered) {
      index += 1;
      return `${index}. ${itemContent}`;
    } else if (item.checked !== null && item.checked !== undefined) {
      return `${options.checkboxPrefix?.(item.checked) ?? '• '}${itemContent}`;
    } else {
      return `• ${itemContent}`;
    }
  });

  return section(contents.join('\n'));
}

function combineBetweenPipes(texts: String[]): string {
  return `| ${texts.join(' | ')} |`;
}

function parseTableRows(rows: Tokens.TableCell[][]): string[] {
  const parsedRows: string[] = [];
  rows.forEach((row, index) => {
    const parsedCells = parseTableRow(row);
    if (index === 1) {
      const headerRowArray = new Array(parsedCells.length).fill('---');
      const headerRow = combineBetweenPipes(headerRowArray);
      parsedRows.push(headerRow);
    }
    parsedRows.push(combineBetweenPipes(parsedCells));
  });
  return parsedRows;
}

function parseTableRow(row: Tokens.TableCell[]): String[] {
  const parsedCells: String[] = [];
  row.forEach(cell => {
    parsedCells.push(parseTableCell(cell));
  });
  return parsedCells;
}

function parseTableCell(cell: Tokens.TableCell): String {
  const texts = cell.tokens.reduce((accumulator, child) => {
    parsePhrasingContentToStrings(child as PhrasingToken, accumulator);
    return accumulator;
  }, [] as string[]);
  return texts.join(' ');
}

function parseTable(element: Tokens.Table): SectionBlock {
  const parsedRows = parseTableRows([element.header, ...element.rows]);

  return section(`\`\`\`\n${parsedRows.join('\n')}\n\`\`\``);
}

function parseBlockquote(element: Tokens.Blockquote): KnownBlock[] {
  return element.tokens
    .filter((child): child is Tokens.Paragraph => child.type === 'paragraph')
    .flatMap(p =>
      parseParagraph(p).map(block => {
        if (isSectionBlock(block) && block.text?.text?.includes('\n'))
          block.text.text = '> ' + block.text.text.replace(/\n/g, '\n> ');
        return block;
      }),
    );
}

function parseThematicBreak(): DividerBlock {
  return divider();
}

function parseHTML(element: Tokens.HTML | Tokens.Tag): KnownBlock[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const res = parser.parse(element.raw);

  if (res.img) {
    const tags = res.img instanceof Array ? res.img : [res.img];

    return tags
      .map((img: Record<string, string>) => {
        const url: string = img['@_src'];
        return image(url, img['@_alt'] || url);
      })
      .filter((e: Record<string, string>) => !!e);
  } else return [];
}

function parseToken(token: Token, options: ParsingOptions): KnownBlock[] {
  switch (token.type) {
    case 'heading':
      return [parseHeading(token as Tokens.Heading)];

    case 'paragraph':
      return parseParagraph(token as Tokens.Paragraph);

    case 'code':
      return [parseCode(token as Tokens.Code)];

    case 'blockquote':
      return parseBlockquote(token as Tokens.Blockquote);

    case 'list':
      return [parseList(token as Tokens.List, options.lists)];

    case 'table':
      return [parseTable(token as Tokens.Table)];

    case 'hr':
      return [parseThematicBreak()];

    case 'html':
      return parseHTML(token as Tokens.HTML);

    default:
      return [];
  }
}

export function parseBlocks(
  tokens: TokensList,
  options: ParsingOptions = {},
): KnownBlock[] {
  return tokens.flatMap(token => parseToken(token, options));
}
