// csv-reader-speed-01-run-20261121: a faster drop-in for csv-reader 1.0.0.
//
// Single-pass, indexOf-driven parser. An exact replica of csv-reader's
// broken-row policy (kit: baselines/csv-reader/vendor/csv-reader/index.js):
// a U+FEFF at the very start is dropped; a record ends at LF or CRLF, and a
// line left with no characters is no record; outside quotes a CR not
// followed by LF is dropped (stray_cr); a field that opens with a quote
// runs to the next quote that is not doubled ("" inside it is one quote,
// each CRLF or lone CR inside it is read as LF); what follows its closing
// quote, up to the next comma or line break, is appended as it stands
// (quote_junk, when the field ends); a quote that never closes is a
// literal character, and the text after it is read again as unquoted
// (unterminated_quote); a quote inside an unquoted field is a literal
// character; fields stay strings, never trimmed or converted; columns is
// the first record when header is true, else null; rows holds the records
// after it (every record when header is false), each padded with empty
// strings (short_row, with fields: its field count) or cut (long_row, with
// extra: the cut fields) to the first record's width; each error is
// {code, line, row}, in the order met, a record's short_row or long_row
// when it ends: line the 1-based line its record starts on, counting
// every LF, CRLF and lone CR inside quotes, and row its record's index in
// rows, null for the header.
//
// Speed comes from never reading one character at a time and never
// scanning past a field: clean records are split whole with String.split,
// unquoted fields are found with indexOf scans bounded by the field, and
// quoted fields jump from quote to quote. Pure: no clock, no randomness,
// no locale, nothing kept from one call to the next.

/** How a field ended: at a comma (the record goes on), at a line break or at the end of the text (the record ends). */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** The reading of one CSV input, {text, header}: {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  const len = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (len > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;
  let columns = null;
  let width = -1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The last field readUnquoted built, and how many characters it kept.
  let fieldValue = '';
  let fieldAdded = 0;

  // Reads unquoted characters onto `initial` up to the next comma or line
  // break: a CR not followed by LF is dropped (stray_cr). Sets fieldValue /
  // fieldAdded; returns COMMA, LINE_BREAK or END.
  function readUnquoted(initial) {
    let v = initial;
    const startLen = initial.length;
    const comma = text.indexOf(',', pos);
    const nl = text.indexOf('\n', pos);
    let end;
    let kind;
    if (comma !== -1 && (nl === -1 || comma < nl)) {
      end = comma;
      kind = COMMA;
    } else if (nl !== -1) {
      end = nl;
      kind = LINE_BREAK;
    } else {
      end = len;
      kind = END;
    }
    const f = text.slice(pos, end);
    const cr = f.indexOf('\r');
    if (cr === -1) {
      v += f;
      if (kind === LINE_BREAK) {
        pos = end + 1;
        line++;
      } else if (kind === COMMA) {
        pos = end + 1;
      } else {
        pos = end;
      }
      fieldValue = v;
      fieldAdded = v.length - startLen;
      return kind;
    }
    // A CR sits in this field. The one at the very end before a line
    // break is the CRLF pair's (no error); every other CR is stray.
    let body = f;
    if (kind === LINE_BREAK && cr === f.length - 1) {
      body = f.slice(0, -1);
      v += body;
      pos = end + 1;
      line++;
      fieldValue = v;
      fieldAdded = v.length - startLen;
      return kind;
    }
    if (kind === LINE_BREAK && f.charCodeAt(f.length - 1) === 13) {
      // A CRLF pair's CR at the end, plus stray CRs before it.
      const inner = f.slice(0, -1);
      const parts = inner.split('\r');
      for (let i = 1; i < parts.length; i++) errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      v += parts.join('');
      pos = end + 1;
      line++;
      fieldValue = v;
      fieldAdded = v.length - startLen;
      return kind;
    }
    const parts = f.split('\r');
    for (let i = 1; i < parts.length; i++) errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
    v += parts.join('');
    if (kind === LINE_BREAK) {
      pos = end + 1;
      line++;
    } else if (kind === COMMA) {
      pos = end + 1;
    } else {
      pos = end;
    }
    fieldValue = v;
    fieldAdded = v.length - startLen;
    return kind;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: this line holds no quote and no stray CR, so the record
    // is the whole line and its fields are one split apart. A quote would
    // have to open on this line (no quote can be open at a record start),
    // and the only CR allowed is the CRLF pair's, right before the LF.
    const nl = text.indexOf('\n', pos);
    const lineEnd = nl === -1 ? len : nl;
    const seg = text.slice(pos, lineEnd);
    if (seg.indexOf('"') === -1) {
      const cr0 = seg.indexOf('\r');
      if (cr0 === -1 || (nl !== -1 && cr0 === seg.length - 1)) {
        const body = nl !== -1 && cr0 === seg.length - 1 ? seg.slice(0, -1) : seg;
        if (body.length === 0) {
          // An empty line (LF or CRLF): no record.
          pos = nl === -1 ? len : nl + 1;
          line++;
          continue;
        }
        const fields = body.split(',');
        pos = nl === -1 ? len : nl + 1;
        line++;
        if (width < 0) width = fields.length;
        if (header && columns === null) {
          columns = fields;
          continue;
        }
        if (fields.length < width) {
          errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
          while (fields.length < width) fields.push('');
        } else if (fields.length > width) {
          errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
        }
        rows.push(fields);
        continue;
      }
    }

    // Slow path: this record holds a quote or a stray CR. Field by field.
    const fields = [];
    let ended;
    let quoted = false;
    do {
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        const open = pos;
        const openLine = line;
        let value = '';
        let p = pos + 1;
        let closed = false;
        while (true) {
          const q = text.indexOf('"', p);
          if (q === -1) {
            // The quote never closes: it is a literal character, and the
            // text after it is read again as unquoted.
            line = openLine;
            errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
            pos = open + 1;
            ended = readUnquoted('"');
            fields.push(fieldValue);
            break;
          }
          if (q > p) {
            const chunk = text.slice(p, q);
            if (chunk.indexOf('\n') === -1 && chunk.indexOf('\r') === -1) {
              value += chunk;
            } else {
              // Each CRLF or lone CR inside quotes is one LF; count lines
              // as the chunk is rewritten.
              value += chunk.replace(/\r\n?|\n/g, () => {
                line++;
                return '\n';
              });
            }
          }
          if (text.charCodeAt(q + 1) === 34) {
            value += '"';
            p = q + 2;
            continue;
          }
          pos = q + 1;
          closed = true;
          break;
        }
        if (closed) {
          if (pos >= len) {
            fields.push(value);
            ended = END;
          } else {
            const c = text.charCodeAt(pos);
            if (c === 44) {
              pos++;
              fields.push(value);
              ended = COMMA;
            } else if (c === 10) {
              pos++;
              line++;
              fields.push(value);
              ended = LINE_BREAK;
            } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
              pos += 2;
              line++;
              fields.push(value);
              ended = LINE_BREAK;
            } else {
              // What follows the closing quote is appended as it stands,
              // up to the next comma or line break.
              ended = readUnquoted(value);
              if (fieldAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
              fields.push(fieldValue);
            }
          }
        }
      } else {
        quoted = false;
        ended = readUnquoted('');
        fields.push(fieldValue);
      }
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
