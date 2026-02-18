import { description, descriptionHtml, label } from "allure-js-commons";
import { expect, it } from "vitest";

it("sample passed test", async () => {
  await label("env", "foo");
  expect(true).toBe(true);
});

it("sample failed test", async () => {
  await label("env", "bar");
  expect(true).toBe(false);
});

it("sample broken test", async () => {
  throw new Error("broken test's reason");
});

it("sample skipped test", async (ctx) => {
  ctx.skip();
});

it("sample test with plain description", async () => {
  await description("Plain text description without any formatting.");
  expect(true).toBe(true);
});

it("sample test with markdown description", async () => {
  await description(
    [
      "# Heading 1",
      "## Heading 2",
      "This is **bold** and _italic_ and `inline code`.",
      "",
      "- List item one",
      "- List item two",
      "",
      "1. First ordered",
      "2. Second ordered",
      "",
      "> Blockquote text",
      "",
      "[Example link](https://example.com)",
      "",
      "| Col1 | Col2 |",
      "|------|------|",
      "| A    | B    |",
      "",
      "```",
      "code block",
      "```",
    ].join("\n"),
  );
  expect(true).toBe(true);
});

it("sample test with descriptionHtml", async () => {
  await descriptionHtml("<p>Custom <strong>HTML</strong> description.</p>");
  expect(true).toBe(true);
});

it("comprehensive HTML tags showcase", async () => {
  await descriptionHtml(`
    <h1>Comprehensive HTML Elements Showcase</h1>
    <p>This test demonstrates all HTML elements that pass DOMPurify sanitization and have custom styling.</p>

    <hr>

    <h2>Headings</h2>
    <h1>Heading 1 - Largest heading</h1>
    <h2>Heading 2 - Section heading</h2>
    <h3>Heading 3 - Subsection heading</h3>
    <h4>Heading 4 - Minor heading</h4>
    <h5>Heading 5 - Small heading</h5>
    <h6>Heading 6 - Smallest heading</h6>

    <hr>

    <h2>Text Formatting</h2>
    <p><strong>&lt;strong&gt;</strong> - Strong importance (bold)</p>
    <p><b>&lt;b&gt;</b> - Bold text</p>
    <p><em>&lt;em&gt;</em> - Emphasis (italic)</p>
    <p><i>&lt;i&gt;</i> - Italic text</p>
    <p><del>&lt;del&gt;</del> - Deleted/strikethrough text</p>
    <p><s>&lt;s&gt;</s> - Strikethrough text</p>
    <p><ins>&lt;ins&gt;</ins> - Inserted/added text (underlined with green background)</p>
    <p><small>&lt;small&gt;</small> - Smaller text</p>
    <p><mark>&lt;mark&gt;</mark> - Highlighted/marked text</p>
    <p><dfn>&lt;dfn&gt;</dfn> - Definition term (italic bold)</p>
    <p><cite>&lt;cite&gt;</cite> - Citation (italic)</p>
    <p>E = mc<sup>2</sup> - <code>&lt;sup&gt;</code> superscript text</p>
    <p>H<sub>2</sub>O - <code>&lt;sub&gt;</code> subscript text</p>
    <p><q>&lt;q&gt;</q> - Inline quotation with auto quotes</p>
    <p><abbr title="HyperText Markup Language">&lt;abbr title="..."&gt;</abbr> - Abbreviation with dotted underline (hover for title)</p>
    <p><time datetime="2026-02-11">&lt;time&gt;</time> - Time element</p>

    <hr>

    <h2>Code and Technical</h2>
    <p><code>&lt;code&gt;</code> - Inline code with background</p>
    <p><kbd>&lt;kbd&gt;</kbd> - Keyboard input (button-like style)</p>
    <p><samp>&lt;samp&gt;</samp> - Sample program output</p>
    <p><var>&lt;var&gt;</var> - Variable in mathematical/programming context</p>

    <h3>Code Block</h3>
    <pre><code>&lt;pre&gt;&lt;code&gt;
function example() {
  console.log("Code block with syntax");
  return true;
}
&lt;/code&gt;&lt;/pre&gt;</code></pre>

    <hr>

    <h2>Lists</h2>

    <h3>Unordered List</h3>
    <ul>
      <li>&lt;ul&gt; Unordered list item 1</li>
      <li>Unordered list item 2</li>
      <li>Unordered list item 3</li>
    </ul>

    <h3>Ordered List</h3>
    <ol>
      <li>&lt;ol&gt; Ordered list item 1</li>
      <li>Ordered list item 2</li>
      <li>Ordered list item 3</li>
    </ol>

    <h3>Definition List</h3>
    <dl>
      <dt>&lt;dt&gt; - Term 1</dt>
      <dd>&lt;dd&gt; - Definition for term 1. This provides a detailed description.</dd>
      <dt>Term 2</dt>
      <dd>Definition for term 2 with more explanation.</dd>
    </dl>

    <hr>

    <h2>Blockquote</h2>
    <blockquote>
      <p>&lt;blockquote&gt; - This is a blockquote. It's used for quoting text from other sources.</p>
      <p>Can contain multiple paragraphs.</p>
    </blockquote>

    <hr>

    <h2>Links</h2>
    <p><a href="https://example.com">&lt;a href="..."&gt;</a> - Hyperlink with underline</p>

    <hr>

    <h2>Tables</h2>
    <table>
      <thead>
        <tr>
          <th>&lt;th&gt; Header 1</th>
          <th>Header 2</th>
          <th>Header 3</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>&lt;td&gt; Row 1, Col 1</td>
          <td>Row 1, Col 2</td>
          <td>Row 1, Col 3</td>
        </tr>
        <tr>
          <td>Row 2, Col 1</td>
          <td>Row 2, Col 2</td>
          <td>Row 2, Col 3</td>
        </tr>
      </tbody>
    </table>

    <hr>

    <h2>Figures</h2>
    <figure>
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC" alt="Small base64 test image" width="200" height="200">
      <figcaption>&lt;figcaption&gt; - Base64 data URI image (small embedded image)</figcaption>
    </figure>
    
    <figure>
      <img src="https://allurereport.org/svg/logo-report-sign.svg" alt="External image from allurereport.org" width="200">
      <figcaption>&lt;figcaption&gt; - External URL image from allurereport.org (https://)</figcaption>
    </figure>

    <hr>

    <h2>Details/Summary (Collapsible)</h2>
    <details>
      <summary>&lt;summary&gt; - Click to expand/collapse</summary>
      <p>&lt;details&gt; - This content is hidden by default and revealed when you click the summary.</p>
      <p>You can include any content here, including lists, code, etc.</p>
    </details>

    <hr>

    <h2>Semantic Structural Elements</h2>
    <article>
      <h3>&lt;article&gt;</h3>
      <p>Self-contained composition that could be independently distributed.</p>
    </article>

    <section>
      <h3>&lt;section&gt;</h3>
      <p>Thematic grouping of content, typically with a heading.</p>
    </section>

    <aside>
      <h3>&lt;aside&gt;</h3>
      <p>Content tangentially related to the content around it.</p>
    </aside>

    <address>
      &lt;address&gt; - Contact information<br>
      123 Example Street<br>
      City, State 12345
    </address>

    <hr>

    <h2>Paragraph</h2>
    <p>&lt;p&gt; - Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
    <p>Multiple paragraphs are automatically spaced. This is the second paragraph with more text to demonstrate spacing and line height.</p>
  `);
  expect(true).toBe(true);
});

it("sample 100x100 description table test", async () => {
  const headerCells = Array.from({ length: 100 }, (_, columnIndex) => `<th>H${columnIndex + 1}</th>`).join("");
  const bodyRows = Array.from({ length: 100 }, (_, rowIndex) => {
    const rowCells = Array.from(
      { length: 100 },
      (_, columnIndex) => `<td>R${rowIndex + 1}C${columnIndex + 1}</td>`,
    ).join("");

    return `<tr>${rowCells}</tr>`;
  }).join("");

  await descriptionHtml(`
    <h1>100x100 table showcase</h1>
    <p>This test renders a 100-column by 100-row HTML table.</p>
    <table>
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `);

  expect(true).toBe(true);
});
