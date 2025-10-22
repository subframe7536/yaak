import type { HttpRequestHeader } from '@yaakapp-internal/models';
import type { GenericCompletionOption } from '@yaakapp-internal/plugins';
import { charsets } from '../lib/data/charsets';
import { connections } from '../lib/data/connections';
import { encodings } from '../lib/data/encodings';
import { headerNames } from '../lib/data/headerNames';
import { mimeTypes } from '../lib/data/mimetypes';
import { CountBadge } from './core/CountBadge';
import { DetailsBanner } from './core/DetailsBanner';
import type { GenericCompletionConfig } from './core/Editor/genericCompletion';
import type { InputProps } from './core/Input';
import type { Pair, PairEditorProps } from './core/PairEditor';
import { PairEditorRow } from './core/PairEditor';
import { ensurePairId } from './core/PairEditor.util';
import { PairOrBulkEditor } from './core/PairOrBulkEditor';
import { HStack } from './core/Stacks';

type Props = {
  forceUpdateKey: string;
  headers: HttpRequestHeader[];
  inheritedHeaders?: HttpRequestHeader[];
  stateKey: string;
  onChange: (headers: HttpRequestHeader[]) => void;
  label?: string;
};

export function HeadersEditor({
  stateKey,
  headers,
  inheritedHeaders,
  onChange,
  forceUpdateKey,
}: Props) {
  const validInheritedHeaders =
    inheritedHeaders?.filter((pair) => pair.enabled && (pair.name || pair.value)) ?? [];
  return (
    <div className="@container w-full h-full grid grid-rows-[auto_minmax(0,1fr)]">
      {validInheritedHeaders.length > 0 ? (
        <DetailsBanner
          color="secondary"
          className="text-sm mb-1.5"
          summary={
            <HStack>
              Inherited <CountBadge count={validInheritedHeaders.length} />
            </HStack>
          }
        >
          <div className="pb-2">
            {validInheritedHeaders?.map((pair, i) => (
              <PairEditorRow
                key={pair.id + '.' + i}
                index={i}
                disabled
                disableDrag
                className="py-1"
                pair={ensurePairId(pair)}
                stateKey={null}
                nameAutocompleteFunctions
                nameAutocompleteVariables
                valueAutocompleteFunctions
                valueAutocompleteVariables
              />
            ))}
          </div>
        </DetailsBanner>
      ) : (
        <span />
      )}
      <PairOrBulkEditor
        forceUpdateKey={forceUpdateKey}
        nameAutocomplete={nameAutocomplete}
        nameAutocompleteFunctions
        nameAutocompleteVariables
        namePlaceholder="Header-Name"
        nameValidate={validateHttpHeader}
        onChange={onChange}
        pairs={headers}
        preferenceName="headers"
        stateKey={stateKey}
        valueType={valueType}
        valueAutocomplete={valueAutocomplete}
        valueAutocompleteFunctions
        valueAutocompleteVariables
      />
    </div>
  );
}

const MIN_MATCH = 3;

const headerOptionsMap: Record<string, string[]> = {
  'content-type': mimeTypes,
  accept: ['*/*', ...mimeTypes],
  'accept-encoding': encodings,
  connection: connections,
  'accept-charset': charsets,
};

const valueType = (pair: Pair): InputProps['type'] => {
  const name = pair.name.toLowerCase().trim();
  if (
    name.includes('authorization') ||
    name.includes('api-key') ||
    name.includes('access-token') ||
    name.includes('auth') ||
    name.includes('secret') ||
    name.includes('token') ||
    name === 'cookie' ||
    name === 'set-cookie'
  ) {
    return 'password';
  } else {
    return 'text';
  }
};

const valueAutocomplete = (headerName: string): GenericCompletionConfig | undefined => {
  const name = headerName.toLowerCase().trim();
  const options: GenericCompletionOption[] =
    headerOptionsMap[name]?.map((o) => ({
      label: o,
      type: 'constant',
      boost: 1, // Put above other completions
    })) ?? [];
  return { minMatch: MIN_MATCH, options };
};

const nameAutocomplete: PairEditorProps['nameAutocomplete'] = {
  minMatch: MIN_MATCH,
  options: headerNames.map((t) =>
    typeof t === 'string'
      ? {
          label: t,
          type: 'constant',
          boost: 1, // Put above other completions
        }
      : {
          ...t,
          boost: 1, // Put above other completions
        },
  ),
};

const validateHttpHeader = (v: string) => {
  if (v === '') {
    return true;
  }

  // Template strings are not allowed so we replace them with a valid example string
  const withoutTemplateStrings = v.replace(/\$\{\[\s*[^\]\s]+\s*]}/gi, '123');
  return withoutTemplateStrings.match(/^[a-zA-Z0-9-_]+$/) !== null;
};
