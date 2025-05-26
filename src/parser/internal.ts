import {
  DividerBlock,
  HeaderBlock,
  ImageBlock,
  KnownBlock,
  SectionBlock,
  RichTextBlock,
  RichTextList,
  RichTextSection,
  RichTextText,
  RichTextLink,
} from '@slack/types';
import {ListOptions, ParsingOptions} from '../types';
import {section, divider, header, image, richText} from '../slack';
import {Token, Tokens, TokensList} from 'marked';
import {XMLParser} from 'fast-xml-parser';

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

  if (
    last &&
    isSectionBlock(last) &&
    last.text &&
    last.text.text &&
    last.text.text.length + content.length <= 3000
  ) {
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

function parsePhrasingContentToRichText(
  element: Exclude<PhrasingToken, Tokens.Image>,
): RichTextText | RichTextLink {
  switch (element.type) {
    case 'link': {
      // For links, we'll create a rich text link element
      const text = element.tokens
        .map(child => parsePhrasingContentToRichText(child as typeof element))
        .map(rt => (rt.type === 'link' ? rt.text || rt.url : rt.text))
        .join('');
      return {
        type: 'link',
        text: text,
        url: element.href,
      } as RichTextLink;
    }

    case 'em': {
      const text = element.tokens
        .map(child =>
          parsePhrasingContentToRichText(
            child as Exclude<PhrasingToken, Tokens.Image>,
          ),
        )
        .map(rt => (rt.type === 'link' ? rt.text || rt.url : rt.text))
        .join('');
      return {
        type: 'text',
        text: text,
        style: {
          italic: true,
        },
      } as RichTextText;
    }

    case 'strong': {
      const text = element.tokens
        .map(child =>
          parsePhrasingContentToRichText(
            child as Exclude<PhrasingToken, Tokens.Image>,
          ),
        )
        .map(rt => (rt.type === 'link' ? rt.text || rt.url : rt.text))
        .join('');
      return {
        type: 'text',
        text: text,
        style: {
          bold: true,
        },
      } as RichTextText;
    }

    case 'del': {
      const text = element.tokens
        .map(child =>
          parsePhrasingContentToRichText(
            child as Exclude<PhrasingToken, Tokens.Image>,
          ),
        )
        .map(rt => (rt.type === 'link' ? rt.text || rt.url : rt.text))
        .join('');
      return {
        type: 'text',
        text: text,
        style: {
          strike: true,
        },
      } as RichTextText;
    }

    case 'codespan':
      return {
        type: 'text',
        text: element.text,
        style: {
          code: true,
        },
      } as RichTextText;

    case 'text':
      return {
        type: 'text',
        text: element.text,
      } as RichTextText;

    default:
      return {
        type: 'text',
        text: '',
      } as RichTextText;
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
): KnownBlock {
  // Use rich text lists if enabled
  if (options.useRichText) {
    return parseListToRichText(element, options, {
      ordered: element.ordered,
      indent: 0,
    });
  }

  // Fall back to the original implementation
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
        if (isSectionBlock(nestedListBlock) && nestedListBlock.text?.text) {
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

interface ListItemContext {
  ordered: boolean;
  indent: number;
  offset?: number;
}

function parseListToRichText(
  element: Tokens.List,
  options: ListOptions = {},
  context: ListItemContext = {ordered: element.ordered, indent: 0},
): RichTextBlock {
  const elements: RichTextList[] = [];

  element.items.forEach(item => {
    // Process all tokens in the list item to build rich text elements
    const richTextElements: (RichTextText | RichTextLink)[] = [];

    item.tokens.forEach(token => {
      if (token.type === 'text') {
        const textToken = token as Tokens.Text;
        if (textToken.tokens?.length) {
          // Process rich text elements from the text tokens
          textToken.tokens.forEach(child => {
            if (child.type !== 'image') {
              const richElement = parsePhrasingContentToRichText(
                child as Exclude<PhrasingToken, Tokens.Image>,
              );
              richTextElements.push(richElement);
            }
          });
        } else {
          richTextElements.push({
            type: 'text',
            text: textToken.text || '',
          } as RichTextText);
        }
      } else if (token.type === 'paragraph') {
        // Handle paragraph tokens
        const paragraphToken = token as Tokens.Paragraph;
        paragraphToken.tokens.forEach(child => {
          if (child.type !== 'image') {
            const richElement = parsePhrasingContentToRichText(
              child as Exclude<PhrasingToken, Tokens.Image>,
            );
            richTextElements.push(richElement);
          }
        });
      } else if (token.type === 'list') {
        // Handle nested lists - first add the current item, then add nested list
        if (richTextElements.length > 0) {
          elements.push({
            type: 'rich_text_list',
            elements: [
              {
                type: 'rich_text_section',
                elements: richTextElements.slice(),
              } as RichTextSection,
            ],
            style: element.ordered ? 'ordered' : 'bullet',
            indent: context.indent,
            border: 0,
          } as RichTextList);

          // Clear for nested processing
          richTextElements.length = 0;
        }

        // Parse nested list with increased indent
        const nestedListBlock = parseListToRichText(
          token as Tokens.List,
          options,
          {
            ordered: (token as Tokens.List).ordered,
            indent: context.indent + 1,
          },
        );

        // Add all elements from the nested list that are RichTextList elements
        nestedListBlock.elements.forEach(element => {
          if (element.type === 'rich_text_list') {
            elements.push(element as RichTextList);
          }
        });
        return; // Skip the rest of processing for this item
      }
    });

    // Create the list item if we have content
    if (richTextElements.length > 0) {
      const listItem: RichTextList = {
        type: 'rich_text_list',
        elements: [
          {
            type: 'rich_text_section',
            elements: richTextElements,
          } as RichTextSection,
        ],
        style: element.ordered ? 'ordered' : 'bullet',
        indent: context.indent,
        border: 0,
      } as RichTextList;

      elements.push(listItem);
    }
  });

  return richText(elements);
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
  const parser = new XMLParser({ignoreAttributes: false});
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
