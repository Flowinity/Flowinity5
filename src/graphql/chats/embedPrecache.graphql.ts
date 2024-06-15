import { gql } from "@apollo/client";
import { StandardEmbedFragment } from "@/graphql/chats/messages.graphql";

export const EmbedPrecacheMutation = gql`
  ${StandardEmbedFragment}
  mutation EmbedResolutionPrecache($input: EmbedPrecacheInput!) {
    embedResolutionPrecache(input: $input) {
      ...StandardEmbed
    }
  }
`;
