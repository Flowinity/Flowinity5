import { gql } from "@apollo/client";

export const TypingSubscription = gql`
  subscription TypingEvent {
    onTyping {
      chatId
      expires
      user {
        id
      }
    }
  }
`;

export const CancelTypingSubscription = gql`
  subscription CancelTypingEvent {
    onCancelTyping {
      chatId
      expires
      user {
        id
      }
    }
  }
`;
