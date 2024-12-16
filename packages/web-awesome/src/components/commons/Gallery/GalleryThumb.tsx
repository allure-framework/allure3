import type {AttachmentTestStepResult} from "@allurereport/core-api";
import {Attachment} from "@/components/app/TestResult/TestResultSteps/attachment";
import * as styles from "@/components/commons/Modal/styles.scss";
import {modalData, openModal} from "@/components/commons/Modal";

export const GalleryThumb = ({item, children}) => {
    const isActiveThumb = modalData.value.data?.link?.id === item.link?.id;

    const showAttach = (showedItem: AttachmentTestStepResult) => {
        openModal({
            data: showedItem,
            component: <Attachment item={showedItem} key={showedItem.link?.id}/>,
        });
    };

    return (
        <div
            className={`${styles["modal-thumb"]} ${isActiveThumb ? styles.active : ""}`}
            onClick={() => showAttach(item as AttachmentTestStepResult)}
        >
            {children}
        </div>
    );
};
