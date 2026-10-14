import React from 'react'
import styles from './index.module.css'

const PopOver = ({ position, height }) => {
  const popoverStyle = {
    height
  }

  const arrowDim = height * Math.sqrt(2)
  const arrowStyle = {
    width: arrowDim,
    height: arrowDim,
    top: position === 'top' ? height - arrowDim / 2 : -arrowDim / 2,
    backgroundColor: 'rgb(237,237,237)'
  }

  return (
    <div className={styles.popover} style={popoverStyle}>
      <div className={styles.arrow} style={arrowStyle} />
    </div>
  )
}

export default PopOver
