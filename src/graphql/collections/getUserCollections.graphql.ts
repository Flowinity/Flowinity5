import { gql } from "@apollo/client";

export const UserLightCollectionsQuery = gql`
  query UserLightCollectionsQuery {
    collections {
      items {
        preview {
          updatedAt
        }
        updatedAt
        createdAt
        avatar
        banner
        itemCount
        id
        image
        shareLink
        permissionsMetadata {
          write
          read
          configure
        }
        name
      }
    }
    collectionInvitesCount
  }
`;

export const UserCollectionsQuery = gql`
  query UserCollectionsQuery($input: UserCollectionsInput!) {
    collections(input: $input) {
      items {
        id
        name
        image
        userId
        shareLink
        user {
          username
          id
          createdAt
          administrator
          moderator
          avatar
        }
        preview {
          attachment {
            attachment
            id
          }
        }
        users {
          id
          createdAt
          updatedAt
          collectionId
          read
          write
          configure
          accepted
          recipientId
          senderId
          identifier
          user {
            username
            id
            administrator
            moderator
            avatar
          }
          sender {
            username
            id
            administrator
            moderator
            avatar
          }
        }
        recipient {
          id
          createdAt
          updatedAt
          collectionId
          read
          write
          configure
          accepted
          recipientId
          senderId
        }
        shared
        itemCount
        permissionsMetadata {
          write
          read
          configure
        }
      }
      pager {
        totalItems
        currentPage
        pageSize
        totalPages
        startPage
        endPage
        startIndex
        endIndex
        pages
      }
    }
  }
`;
