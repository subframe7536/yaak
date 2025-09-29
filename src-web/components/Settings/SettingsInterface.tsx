import { type } from '@tauri-apps/plugin-os';
import { useFonts } from '@yaakapp-internal/fonts';
import { useLicense } from '@yaakapp-internal/license';
import type { EditorKeymap } from '@yaakapp-internal/models';
import { patchModel, settingsAtom } from '@yaakapp-internal/models';
import { useAtomValue } from 'jotai';
import React from 'react';
import { activeWorkspaceAtom } from '../../hooks/useActiveWorkspace';
import { clamp } from '../../lib/clamp';
import { showConfirm } from '../../lib/confirm';
import { Checkbox } from '../core/Checkbox';
import { Icon } from '../core/Icon';
import { Link } from '../core/Link';
import { Select } from '../core/Select';
import { HStack, VStack } from '../core/Stacks';

const NULL_FONT_VALUE = '__NULL_FONT__';

const fontSizeOptions = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
].map((n) => ({ label: `${n}`, value: `${n}` }));

const keymaps: { value: EditorKeymap; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'vim', label: 'Vim' },
  { value: 'vscode', label: 'VSCode' },
  { value: 'emacs', label: 'Emacs' },
];

export function SettingsInterface() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const settings = useAtomValue(settingsAtom);
  const fonts = useFonts();
  const license = useLicense();

  if (settings == null || workspace == null) {
    return null;
  }

  return (
    <VStack space={3} className="mb-4">
      <HStack space={2} alignItems="end">
        {fonts.data && (
          <Select
            size="sm"
            name="uiFont"
            label="Interface Font"
            value={settings.interfaceFont ?? NULL_FONT_VALUE}
            options={[
              { label: 'System Default', value: NULL_FONT_VALUE },
              ...(fonts.data.uiFonts.map((f) => ({
                label: f,
                value: f,
              })) ?? []),
              // Some people like monospace fonts for the UI
              ...(fonts.data.editorFonts.map((f) => ({
                label: f,
                value: f,
              })) ?? []),
            ]}
            onChange={async (v) => {
              const interfaceFont = v === NULL_FONT_VALUE ? null : v;
              await patchModel(settings, { interfaceFont });
            }}
          />
        )}
        <Select
          hideLabel
          size="sm"
          name="interfaceFontSize"
          label="Interface Font Size"
          defaultValue="15"
          value={`${settings.interfaceFontSize}`}
          options={fontSizeOptions}
          onChange={(v) => patchModel(settings, { interfaceFontSize: parseInt(v) })}
        />
      </HStack>
      <HStack space={2} alignItems="end">
        {fonts.data && (
          <Select
            size="sm"
            name="editorFont"
            label="Editor Font"
            value={settings.editorFont ?? NULL_FONT_VALUE}
            options={[
              { label: 'System Default', value: NULL_FONT_VALUE },
              ...(fonts.data.editorFonts.map((f) => ({
                label: f,
                value: f,
              })) ?? []),
            ]}
            onChange={async (v) => {
              const editorFont = v === NULL_FONT_VALUE ? null : v;
              await patchModel(settings, { editorFont });
            }}
          />
        )}
        <Select
          hideLabel
          size="sm"
          name="editorFontSize"
          label="Editor Font Size"
          defaultValue="13"
          value={`${settings.editorFontSize}`}
          options={fontSizeOptions}
          onChange={(v) =>
            patchModel(settings, { editorFontSize: clamp(parseInt(v) || 14, 8, 30) })
          }
        />
      </HStack>
      <Select
        leftSlot={<Icon icon="keyboard" color="secondary" />}
        size="sm"
        name="editorKeymap"
        label="Editor Keymap"
        value={`${settings.editorKeymap}`}
        options={keymaps}
        onChange={(v) => patchModel(settings, { editorKeymap: v })}
      />
      <Checkbox
        checked={settings.editorSoftWrap}
        title="Wrap Editor Lines"
        onChange={(editorSoftWrap) => patchModel(settings, { editorSoftWrap })}
      />
      <Checkbox
        checked={settings.coloredMethods}
        title="Colorize Request Methods"
        onChange={(coloredMethods) => patchModel(settings, { coloredMethods })}
      />
      {license.check.data?.type === 'personal_use' && (
        <Checkbox
          checked={!settings.licenseBadge}
          title="Hide personal use badge"
          onChange={async (hide) => {
            if (hide) {
              const confirmed = await showConfirm({
                id: 'hide-license-badge',
                title: 'Hide License Badge',
                confirmText: 'Hide Badge',
                description: (
                  <>
                    Only proceed if you’re using Yaak for personal projects only. If you’re using it
                    at work, please <Link href="https://yaak.app/">Purchase a License</Link>.
                  </>
                ),
                requireTyping: 'Personal Use',
                color: 'notice',
              });
              if (!confirmed) return;
            }
            await patchModel(settings, { licenseBadge: !hide });
          }}
        />
      )}

      {type() !== 'macos' && (
        <Checkbox
          checked={settings.hideWindowControls}
          title="Hide Window Controls"
          help="Hide the close/maximize/minimize controls on Windows or Linux"
          onChange={(hideWindowControls) => patchModel(settings, { hideWindowControls })}
        />
      )}
    </VStack>
  );
}
