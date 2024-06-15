import { gql } from "@apollo/client";

export const NoteQuery = gql`
  query Note($input: NoteInput!) {
    note(input: $input) {
      permissions {
        modify
        read
        configure
      }
      id
      createdAt
      updatedAt
      name
      data {
        version
        blocks
        time
      }
      workspaceFolderId
      shareLink
      versions {
        id
        noteId
        userId
        data {
          version
          blocks
          time
        }
      }
    }
  }
`;
