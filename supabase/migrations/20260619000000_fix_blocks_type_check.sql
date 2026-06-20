-- Fix: blocks.type CHECK-Constraint an die in der App genutzten Werte angleichen.
--
-- Das ursprüngliche Schema (20250213000000_init_schema.sql) erlaubte nur
--   ('holiday', 'break', 'maintenance', 'other').
-- Die App (Abwesenheiten-Modal, /api/blocks, use-blocks) verwendet aber
-- 'vacation' (Urlaub) und 'sick' (Krankheit) — 'vacation' ist sogar der Default.
-- Dadurch schlug das Anlegen einer Urlaubs-/Krankheits-Abwesenheit mit einer
-- CHECK-Constraint-Verletzung fehl ("Block konnte nicht erstellt werden").
--
-- Wir erweitern den erlaubten Wertebereich um 'vacation' und 'sick' und behalten
-- 'holiday' bei, damit eventuell bereits vorhandene Zeilen gültig bleiben.

ALTER TABLE blocks DROP CONSTRAINT IF EXISTS blocks_type_check;

ALTER TABLE blocks
  ADD CONSTRAINT blocks_type_check
  CHECK (type IN ('vacation', 'sick', 'holiday', 'break', 'maintenance', 'other'));
