alter table document_connectors
  drop constraint if exists document_connectors_provider_check;

alter table document_connectors
  add constraint document_connectors_provider_check
  check (provider in ('confluence', 'sharepoint', 'jira', 'monday'));

alter table documents
  drop constraint if exists documents_source_provider_check;

alter table documents
  add constraint documents_source_provider_check
  check (source_provider in ('confluence', 'sharepoint', 'jira', 'monday'));
