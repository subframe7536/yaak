import type { EditorView } from '@codemirror/view';
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import classNames from 'classnames';
import {
  forwardRef,
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { WrappedEnvironmentVariable } from '../../hooks/useEnvironmentVariables';
import { useRandomKey } from '../../hooks/useRandomKey';
import { useToggle } from '../../hooks/useToggle';
import { languageFromContentType } from '../../lib/contentType';
import { showDialog } from '../../lib/dialog';
import { computeSideForDragMove } from '../../lib/dnd';
import { showPrompt } from '../../lib/prompt';
import { DropMarker } from '../DropMarker';
import { SelectFile } from '../SelectFile';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import type { DropdownItem } from './Dropdown';
import { Dropdown } from './Dropdown';
import type { EditorProps } from './Editor/Editor';
import type { GenericCompletionConfig } from './Editor/genericCompletion';
import { Editor } from './Editor/LazyEditor';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import type { InputProps } from './Input';
import { Input } from './Input';
import { ensurePairId } from './PairEditor.util';
import { PlainInput } from './PlainInput';
import type { RadioDropdownItem } from './RadioDropdown';
import { RadioDropdown } from './RadioDropdown';

export interface PairEditorRef {
  focusValue(index: number): void;
}

export type PairEditorProps = {
  allowFileValues?: boolean;
  allowMultilineValues?: boolean;
  className?: string;
  forcedEnvironmentId?: string;
  forceUpdateKey?: string;
  nameAutocomplete?: GenericCompletionConfig;
  nameAutocompleteFunctions?: boolean;
  nameAutocompleteVariables?: boolean;
  namePlaceholder?: string;
  nameValidate?: InputProps['validate'];
  noScroll?: boolean;
  onChange: (pairs: PairWithId[]) => void;
  pairs: Pair[];
  stateKey: InputProps['stateKey'];
  valueAutocomplete?: (name: string) => GenericCompletionConfig | undefined;
  valueAutocompleteFunctions?: boolean;
  valueAutocompleteVariables?: boolean | 'environment';
  valuePlaceholder?: string;
  valueType?: InputProps['type'] | ((pair: Pair) => InputProps['type']);
  valueValidate?: InputProps['validate'];
};

export type Pair = {
  id?: string;
  enabled?: boolean;
  name: string;
  value: string;
  contentType?: string;
  isFile?: boolean;
  readOnlyName?: boolean;
};

export type PairWithId = Pair & {
  id: string;
};

/** Max number of pairs to show before prompting the user to reveal the rest */
const MAX_INITIAL_PAIRS = 50;

export const PairEditor = forwardRef<PairEditorRef, PairEditorProps>(function PairEditor(
  {
    allowFileValues,
    allowMultilineValues,
    className,
    forcedEnvironmentId,
    forceUpdateKey,
    nameAutocomplete,
    nameAutocompleteFunctions,
    nameAutocompleteVariables,
    namePlaceholder,
    nameValidate,
    noScroll,
    onChange,
    pairs: originalPairs,
    stateKey,
    valueAutocomplete,
    valueAutocompleteFunctions,
    valueAutocompleteVariables,
    valuePlaceholder,
    valueType,
    valueValidate,
  }: PairEditorProps,
  ref,
) {
  const [forceFocusNamePairId, setForceFocusNamePairId] = useState<string | null>(null);
  const [forceFocusValuePairId, setForceFocusValuePairId] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<PairWithId | null>(null);
  const [pairs, setPairs] = useState<PairWithId[]>([]);
  const [showAll, toggleShowAll] = useToggle(false);
  // NOTE: Use local force update key because we trigger an effect on forceUpdateKey change. If
  //  we simply pass forceUpdateKey to the editor, the data set by useEffect will be stale.
  const [localForceUpdateKey, regenerateLocalForceUpdateKey] = useRandomKey();

  useImperativeHandle(
    ref,
    () => ({
      focusValue(index: number) {
        const id = pairs[index]?.id ?? 'n/a';
        setForceFocusValuePairId(id);
      },
    }),
    [pairs],
  );

  useEffect(() => {
    // Remove empty headers on initial render and ensure they all have valid ids (pairs didn't use to have IDs)
    const newPairs: PairWithId[] = [];
    for (let i = 0; i < originalPairs.length; i++) {
      const p = originalPairs[i];
      if (!p) continue; // Make TS happy
      if (isPairEmpty(p)) continue;
      newPairs.push(ensurePairId(p));
    }

    // Add empty last pair if there is none
    const lastPair = newPairs[newPairs.length - 1];
    if (lastPair == null || !isPairEmpty(lastPair)) {
      newPairs.push(emptyPair());
    }

    setPairs(newPairs);
    regenerateLocalForceUpdateKey();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceUpdateKey]);

  const setPairsAndSave = useCallback(
    (fn: (pairs: PairWithId[]) => PairWithId[]) => {
      setPairs((oldPairs) => {
        const pairs = fn(oldPairs);
        onChange(pairs);
        return pairs;
      });
    },
    [onChange],
  );

  const handleChange = useCallback(
    (pair: PairWithId) =>
      setPairsAndSave((pairs) => pairs.map((p) => (pair.id !== p.id ? p : pair))),
    [setPairsAndSave],
  );

  const handleDelete = useCallback(
    (pair: Pair, focusPrevious: boolean) => {
      if (focusPrevious) {
        const index = pairs.findIndex((p) => p.id === pair.id);
        const id = pairs[index - 1]?.id ?? null;
        setForceFocusNamePairId(id);
      }
      return setPairsAndSave((oldPairs) => oldPairs.filter((p) => p.id !== pair.id));
    },
    [setPairsAndSave, setForceFocusNamePairId, pairs],
  );

  const handleFocusName = useCallback((pair: Pair) => {
    setForceFocusNamePairId(null); // Remove focus override when something focused
    setForceFocusValuePairId(null); // Remove focus override when something focused
    setPairs((pairs) => {
      const isLast = pair.id === pairs[pairs.length - 1]?.id;
      if (isLast) {
        const prevPair = pairs[pairs.length - 1];
        setTimeout(() => setForceFocusNamePairId(prevPair?.id ?? null));
        return [...pairs, emptyPair()];
      } else {
        return pairs;
      }
    });
  }, []);

  const handleFocusValue = useCallback((pair: Pair) => {
    setForceFocusNamePairId(null); // Remove focus override when something focused
    setForceFocusValuePairId(null); // Remove focus override when something focused
    setPairs((pairs) => {
      const isLast = pair.id === pairs[pairs.length - 1]?.id;
      if (isLast) {
        const prevPair = pairs[pairs.length - 1];
        setTimeout(() => setForceFocusValuePairId(prevPair?.id ?? null));
        return [...pairs, emptyPair()];
      } else {
        return pairs;
      }
    });
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // dnd-kit: show the “between rows” marker while hovering
  const onDragMove = useCallback(
    (e: DragMoveEvent) => {
      const overId = e.over?.id as string | undefined;
      if (!overId) return setHoveredIndex(null);

      const overPair = pairs.find((p) => p.id === overId);
      if (overPair == null) return setHoveredIndex(null);

      const side = computeSideForDragMove(overPair.id, e);
      const overIndex = pairs.findIndex((p) => p.id === overId);
      const hoveredIndex = overIndex + (side === 'above' ? 0 : 1);

      setHoveredIndex(hoveredIndex);
    },
    [pairs],
  );

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      const pair = pairs.find((p) => p.id === e.active.id);
      setIsDragging(pair ?? null);
    },
    [pairs],
  );

  const onDragCancel = useCallback(() => setIsDragging(null), []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setIsDragging(null);
      setHoveredIndex(null);
      const activeId = e.active.id as string | undefined;
      const overId = e.over?.id as string | undefined;
      if (!activeId || !overId) return;

      const from = pairs.findIndex((p) => p.id === activeId);
      const baseTo = pairs.findIndex((p) => p.id === overId);
      const to = hoveredIndex ?? (baseTo === -1 ? from : baseTo);

      if (from !== -1 && to !== -1 && from !== to) {
        setPairsAndSave((ps) => {
          const next = [...ps];
          const [moved] = next.splice(from, 1);
          if (moved === undefined) return ps; // Make TS happy
          next.splice(to > from ? to - 1 : to, 0, moved);
          return next;
        });
      }
    },
    [pairs, hoveredIndex, setPairsAndSave],
  );

  return (
    <div
      className={classNames(
        className,
        '@container relative',
        'pb-2 mb-auto h-full',
        !noScroll && 'overflow-y-auto max-h-full',
        // Move over the width of the drag handle
        '-mr-2 pr-2',
        // Pad to make room for the drag divider
        'pt-0.5',
      )}
    >
      <DndContext
        autoScroll
        sensors={sensors}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        collisionDetection={pointerWithin}
      >
        {pairs.map((p, i) => {
          if (!showAll && i > MAX_INITIAL_PAIRS) return null;

          const isLast = i === pairs.length - 1;
          return (
            <Fragment key={p.id}>
              {hoveredIndex === i && <DropMarker />}
              <PairEditorRow
                allowFileValues={allowFileValues}
                allowMultilineValues={allowMultilineValues}
                className="py-1"
                forcedEnvironmentId={forcedEnvironmentId}
                forceFocusNamePairId={forceFocusNamePairId}
                forceFocusValuePairId={forceFocusValuePairId}
                forceUpdateKey={localForceUpdateKey}
                index={i}
                isLast={isLast}
                isDraggingGlobal={!!isDragging}
                nameAutocomplete={nameAutocomplete}
                nameAutocompleteFunctions={nameAutocompleteFunctions}
                nameAutocompleteVariables={nameAutocompleteVariables}
                namePlaceholder={namePlaceholder}
                nameValidate={nameValidate}
                onChange={handleChange}
                onDelete={handleDelete}
                onFocusName={handleFocusName}
                onFocusValue={handleFocusValue}
                pair={p}
                stateKey={stateKey}
                valueAutocomplete={valueAutocomplete}
                valueAutocompleteFunctions={valueAutocompleteFunctions}
                valueAutocompleteVariables={valueAutocompleteVariables}
                valuePlaceholder={valuePlaceholder}
                valueType={valueType}
                valueValidate={valueValidate}
              />
            </Fragment>
          );
        })}
        {!showAll && pairs.length > MAX_INITIAL_PAIRS && (
          <Button onClick={toggleShowAll} variant="border" className="m-2" size="xs">
            Show {pairs.length - MAX_INITIAL_PAIRS} More
          </Button>
        )}
        <DragOverlay dropAnimation={null}>
          {isDragging && (
            <PairEditorRow
              namePlaceholder={namePlaceholder}
              valuePlaceholder={valuePlaceholder}
              className="opacity-80"
              pair={isDragging}
              index={0}
              stateKey={null}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
});

type PairEditorRowProps = {
  className?: string;
  pair: PairWithId;
  forceFocusNamePairId?: string | null;
  forceFocusValuePairId?: string | null;
  onChange?: (pair: PairWithId) => void;
  onDelete?: (pair: PairWithId, focusPrevious: boolean) => void;
  onFocusName?: (pair: PairWithId) => void;
  onFocusValue?: (pair: PairWithId) => void;
  onSubmit?: (pair: PairWithId) => void;
  isLast?: boolean;
  disabled?: boolean;
  disableDrag?: boolean;
  index: number;
  isDraggingGlobal?: boolean;
} & Pick<
  PairEditorProps,
  | 'allowFileValues'
  | 'allowMultilineValues'
  | 'forcedEnvironmentId'
  | 'forceUpdateKey'
  | 'nameAutocomplete'
  | 'nameAutocompleteVariables'
  | 'namePlaceholder'
  | 'nameValidate'
  | 'nameAutocompleteFunctions'
  | 'stateKey'
  | 'valueAutocomplete'
  | 'valueAutocompleteFunctions'
  | 'valueAutocompleteVariables'
  | 'valuePlaceholder'
  | 'valueType'
  | 'valueValidate'
>;

export function PairEditorRow({
  allowFileValues,
  allowMultilineValues,
  className,
  disableDrag,
  disabled,
  forceFocusNamePairId,
  forceFocusValuePairId,
  forceUpdateKey,
  forcedEnvironmentId,
  index,
  isLast,
  nameAutocomplete,
  nameAutocompleteFunctions,
  nameAutocompleteVariables,
  namePlaceholder,
  nameValidate,
  isDraggingGlobal,
  onChange,
  onDelete,
  onFocusName,
  onFocusValue,
  pair,
  stateKey,
  valueAutocomplete,
  valueAutocompleteFunctions,
  valueAutocompleteVariables,
  valuePlaceholder,
  valueType,
  valueValidate,
}: PairEditorRowProps) {
  const nameInputRef = useRef<EditorView>(null);
  const valueInputRef = useRef<EditorView>(null);

  useEffect(() => {
    if (forceFocusNamePairId === pair.id) {
      nameInputRef.current?.focus();
    }
  }, [forceFocusNamePairId, pair.id]);

  useEffect(() => {
    if (forceFocusValuePairId === pair.id) {
      valueInputRef.current?.focus();
    }
  }, [forceFocusValuePairId, pair.id]);

  const handleFocusName = useCallback(() => onFocusName?.(pair), [onFocusName, pair]);
  const handleFocusValue = useCallback(() => onFocusValue?.(pair), [onFocusValue, pair]);
  const handleDelete = useCallback(() => onDelete?.(pair, false), [onDelete, pair]);

  const handleChangeEnabled = useMemo(
    () => (enabled: boolean) => onChange?.({ ...pair, enabled }),
    [onChange, pair],
  );

  const handleChangeName = useMemo(
    () => (name: string) => onChange?.({ ...pair, name }),
    [onChange, pair],
  );

  const handleChangeValueText = useMemo(
    () => (value: string) => onChange?.({ ...pair, value, isFile: false }),
    [onChange, pair],
  );

  const handleChangeValueFile = useMemo(
    () =>
      ({ filePath }: { filePath: string | null }) =>
        onChange?.({ ...pair, value: filePath ?? '', isFile: true }),
    [onChange, pair],
  );

  const handleChangeValueContentType = useMemo(
    () => (contentType: string) => onChange?.({ ...pair, contentType }),
    [onChange, pair],
  );

  const handleEditMultiLineValue = useCallback(
    () =>
      showDialog({
        id: 'pair-edit-multiline',
        size: 'dynamic',
        title: <>Edit {pair.name}</>,
        render: ({ hide }) => (
          <MultilineEditDialog
            hide={hide}
            onChange={handleChangeValueText}
            defaultValue={pair.value}
            contentType={pair.contentType ?? null}
          />
        ),
      }),
    [handleChangeValueText, pair.contentType, pair.name, pair.value],
  );

  const defaultItems = useMemo(
    (): DropdownItem[] => [
      {
        label: 'Edit Multi-line',
        onSelect: handleEditMultiLineValue,
        hidden: !allowMultilineValues,
      },
      {
        label: 'Delete',
        onSelect: handleDelete,
        color: 'danger',
      },
    ],
    [allowMultilineValues, handleDelete, handleEditMultiLineValue],
  );

  const { attributes, listeners, setNodeRef: setDraggableRef } = useDraggable({ id: pair.id });
  const { setNodeRef: setDroppableRef } = useDroppable({ id: pair.id });

  // Filter out the current pair name
  const valueAutocompleteVariablesFiltered = useMemo<EditorProps['autocompleteVariables']>(() => {
    if (valueAutocompleteVariables === 'environment') {
      return (v: WrappedEnvironmentVariable): boolean => v.variable.name !== pair.name;
    } else {
      return valueAutocompleteVariables;
    }
  }, [pair.name, valueAutocompleteVariables]);

  const handleSetRef = useCallback(
    (n: HTMLDivElement | null) => {
      setDraggableRef(n);
      setDroppableRef(n);
    },
    [setDraggableRef, setDroppableRef],
  );

  return (
    <div
      ref={handleSetRef}
      className={classNames(
        className,
        'group grid grid-cols-[auto_auto_minmax(0,1fr)_auto]',
        'grid-rows-1 items-center',
        !pair.enabled && 'opacity-60',
      )}
    >
      <Checkbox
        hideLabel
        title={pair.enabled ? 'Disable item' : 'Enable item'}
        disabled={isLast || disabled}
        checked={isLast ? false : !!pair.enabled}
        className={classNames(isLast && '!opacity-disabled')}
        onChange={handleChangeEnabled}
      />
      {!isLast && !disableDrag ? (
        <div
          {...attributes}
          {...listeners}
          className={classNames(
            'py-2 h-7 w-4 flex items-center',
            'justify-center opacity-0 group-hover:opacity-70',
          )}
        >
          <Icon size="sm" icon="grip_vertical" className="pointer-events-none" />
        </div>
      ) : (
        <span className="w-4" />
      )}
      <div
        className={classNames(
          'grid items-center',
          '@xs:gap-2 @xs:!grid-rows-1 @xs:!grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
          'gap-0.5 grid-cols-1 grid-rows-2',
        )}
      >
        {isLast ? (
          // Use PlainInput for last ones because there's a unique bug where clicking below
          // the Codemirror input focuses it.
          <PlainInput
            hideLabel
            size="sm"
            containerClassName={classNames(isLast && 'border-dashed')}
            className={classNames(isDraggingGlobal && 'pointer-events-none')}
            label="Name"
            name={`name[${index}]`}
            onFocus={handleFocusName}
            placeholder={namePlaceholder ?? 'name'}
          />
        ) : (
          <Input
            ref={nameInputRef}
            hideLabel
            stateKey={`name.${pair.id}.${stateKey}`}
            disabled={disabled}
            wrapLines={false}
            readOnly={pair.readOnlyName || isDraggingGlobal}
            size="sm"
            required={!isLast && !!pair.enabled && !!pair.value}
            validate={nameValidate}
            forcedEnvironmentId={forcedEnvironmentId}
            forceUpdateKey={forceUpdateKey}
            containerClassName={classNames('bg-surface', isLast && 'border-dashed')}
            defaultValue={pair.name}
            label="Name"
            name={`name[${index}]`}
            onChange={handleChangeName}
            onFocus={handleFocusName}
            placeholder={namePlaceholder ?? 'name'}
            autocomplete={nameAutocomplete}
            autocompleteVariables={nameAutocompleteVariables}
            autocompleteFunctions={nameAutocompleteFunctions}
          />
        )}
        <div className="w-full grid grid-cols-[minmax(0,1fr)_auto] gap-1 items-center">
          {pair.isFile ? (
            <SelectFile
              disabled={disabled}
              inline
              size="xs"
              filePath={pair.value}
              onChange={handleChangeValueFile}
            />
          ) : isLast ? (
            // Use PlainInput for last ones because there's a unique bug where clicking below
            // the Codemirror input focuses it.
            <PlainInput
              hideLabel
              disabled={disabled}
              size="sm"
              containerClassName={classNames(isLast && 'border-dashed')}
              label="Value"
              name={`value[${index}]`}
              className={classNames(isDraggingGlobal && 'pointer-events-none')}
              onFocus={handleFocusValue}
              placeholder={valuePlaceholder ?? 'value'}
            />
          ) : pair.value.includes('\n') ? (
            <Button
              color="secondary"
              size="sm"
              onClick={handleEditMultiLineValue}
              title={pair.value}
              className="text-xs font-mono"
            >
              {pair.value.split('\n').join(' ')}
            </Button>
          ) : (
            <Input
              ref={valueInputRef}
              hideLabel
              stateKey={`value.${pair.id}.${stateKey}`}
              wrapLines={false}
              size="sm"
              disabled={disabled}
              readOnly={isDraggingGlobal}
              containerClassName={classNames('bg-surface', isLast && 'border-dashed')}
              validate={valueValidate}
              forcedEnvironmentId={forcedEnvironmentId}
              forceUpdateKey={forceUpdateKey}
              defaultValue={pair.value}
              label="Value"
              name={`value[${index}]`}
              onChange={handleChangeValueText}
              onFocus={handleFocusValue}
              type={isLast ? 'text' : typeof valueType === 'function' ? valueType(pair) : valueType}
              placeholder={valuePlaceholder ?? 'value'}
              autocomplete={valueAutocomplete?.(pair.name)}
              autocompleteFunctions={valueAutocompleteFunctions}
              autocompleteVariables={valueAutocompleteVariablesFiltered}
            />
          )}
        </div>
      </div>
      {allowFileValues ? (
        <FileActionsDropdown
          pair={pair}
          onChangeFile={handleChangeValueFile}
          onChangeText={handleChangeValueText}
          onChangeContentType={handleChangeValueContentType}
          onDelete={handleDelete}
          editMultiLine={handleEditMultiLineValue}
        />
      ) : (
        <Dropdown items={defaultItems}>
          <IconButton
            iconSize="sm"
            size="xs"
            icon={isLast || disabled ? 'empty' : 'chevron_down'}
            title="Select form data type"
            className="text-text-subtle"
          />
        </Dropdown>
      )}
    </div>
  );
}

const fileItems: RadioDropdownItem<string>[] = [
  { label: 'Text', value: 'text' },
  { label: 'File', value: 'file' },
];

function FileActionsDropdown({
  pair,
  onChangeFile,
  onChangeText,
  onChangeContentType,
  onDelete,
  editMultiLine,
}: {
  pair: Pair;
  onChangeFile: ({ filePath }: { filePath: string | null }) => void;
  onChangeText: (text: string) => void;
  onChangeContentType: (contentType: string) => void;
  onDelete: () => void;
  editMultiLine: () => void;
}) {
  const onChange = useCallback(
    (v: string) => {
      if (v === 'file') onChangeFile({ filePath: '' });
      else onChangeText('');
    },
    [onChangeFile, onChangeText],
  );

  const itemsAfter = useMemo<DropdownItem[]>(
    () => [
      {
        label: 'Edit Multi-Line',
        leftSlot: <Icon icon="file_code" />,
        hidden: pair.isFile,
        onSelect: editMultiLine,
      },
      {
        label: 'Set Content-Type',
        leftSlot: <Icon icon="pencil" />,
        onSelect: async () => {
          const contentType = await showPrompt({
            id: 'content-type',
            title: 'Override Content-Type',
            label: 'Content-Type',
            placeholder: 'text/plain',
            defaultValue: pair.contentType ?? '',
            confirmText: 'Set',
            description: 'Leave blank to auto-detect',
          });
          if (contentType == null) return;
          onChangeContentType(contentType);
        },
      },
      {
        label: 'Unset File',
        leftSlot: <Icon icon="x" />,
        hidden: pair.isFile,
        onSelect: async () => {
          onChangeFile({ filePath: null });
        },
      },
      {
        label: 'Delete',
        onSelect: onDelete,
        variant: 'danger',
        leftSlot: <Icon icon="trash" />,
        color: 'danger',
      },
    ],
    [editMultiLine, onChangeContentType, onChangeFile, onDelete, pair.contentType, pair.isFile],
  );

  return (
    <RadioDropdown
      value={pair.isFile ? 'file' : 'text'}
      onChange={onChange}
      items={fileItems}
      itemsAfter={itemsAfter}
    >
      <IconButton iconSize="sm" size="xs" icon="chevron_down" title="Select form data type" />
    </RadioDropdown>
  );
}

function emptyPair(): PairWithId {
  return ensurePairId({ enabled: true, name: '', value: '' });
}

function isPairEmpty(pair: Pair): boolean {
  return !pair.name && !pair.value;
}

function MultilineEditDialog({
  defaultValue,
  contentType,
  onChange,
  hide,
}: {
  defaultValue: string;
  contentType: string | null;
  onChange: (value: string) => void;
  hide: () => void;
}) {
  const [value, setValue] = useState<string>(defaultValue);
  const language = languageFromContentType(contentType, value);
  return (
    <div className="w-[100vw] max-w-[40rem] h-[50vh] max-h-full grid grid-rows-[minmax(0,1fr)_auto]">
      <Editor
        heightMode="auto"
        defaultValue={defaultValue}
        language={language}
        onChange={setValue}
        stateKey={null}
        autocompleteFunctions
        autocompleteVariables
      />
      <div>
        <Button
          color="primary"
          className="ml-auto my-2"
          onClick={() => {
            onChange(value);
            hide();
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
