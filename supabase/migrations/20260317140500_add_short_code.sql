-- Migration: Add short_code to boards table
alter table boards add column short_code text unique;
